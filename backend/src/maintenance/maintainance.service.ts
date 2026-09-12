import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatusStateMachine } from './ticket-status.state-machine';
import { TicketNotFoundException } from '../common/exceptions/operations/ticket-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { HousekeeperNotFoundException } from '../common/exceptions/operations/housekeeper-not-found.exception';
import { CreateTicketDto, AssignTicketDto, ListTicketsQuery } from './dto/maintenance.dto';
import {
  MaintenanceTicket,
  Priority,
  Role,
  RoomStatus,
  TicketStatus,
  Prisma,
} from '@prisma/client';
import { ScopedActor } from '../properties/properties.service';

// ─── Include shape reused across queries ──────────────────────────────────────

const TICKET_INCLUDE = {
  room: { select: { id: true, number: true, propertyId: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
} satisfies Prisma.MaintenanceTicketInclude;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Create Ticket ──────────────────────────────────────────────────────────

  /**
   * Creates a new OPEN maintenance ticket for a given room.
   * The room must exist.
   */
  async createTicket(dto: CreateTicketDto, actor: ScopedActor): Promise<MaintenanceTicket> {
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) {
      throw new RoomNotFoundException(dto.roomId);
    }

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        roomId: dto.roomId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: (dto.priority as Priority) ?? Priority.MEDIUM,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({
      event: 'TICKET_CREATED',
      ticketId: ticket.id,
      roomId: dto.roomId,
      priority: ticket.priority,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_CREATED',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticket.id,
      metadata: { roomId: dto.roomId, priority: ticket.priority, category: dto.category },
    });

    return ticket;
  }

  // ─── List Tickets ───────────────────────────────────────────────────────────

  /**
   * Returns tickets with optional filters.
   */
  async listTickets(query: ListTicketsQuery): Promise<MaintenanceTicket[]> {
    const where: Prisma.MaintenanceTicketWhereInput = {};

    if (query.propertyId) where.room = { propertyId: query.propertyId };
    if (query.roomId) where.roomId = query.roomId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.status) where.status = query.status as TicketStatus;
    if (query.priority) where.priority = query.priority as Priority;

    return this.prisma.maintenanceTicket.findMany({
      where,
      include: TICKET_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ─── Get Ticket ─────────────────────────────────────────────────────────────

  async getTicket(ticketId: string): Promise<MaintenanceTicket> {
    return this.getTicketOrThrow(ticketId);
  }

  // ─── Assign Ticket ──────────────────────────────────────────────────────────

  /**
   * Assigns a ticket to a MAINTENANCE-role technician.
   * Transitions: OPEN → ASSIGNED (or re-assigns by going ASSIGNED → OPEN → ASSIGNED).
   */
  async assignTicket(
    ticketId: string,
    dto: AssignTicketDto,
    actor: ScopedActor,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);

    const technician = await this.prisma.user.findUnique({ where: { id: dto.technicianId } });
    if (!technician || technician.role !== Role.MAINTENANCE) {
      throw new HousekeeperNotFoundException(dto.technicianId);
    }

    // Reassignment: pivot through OPEN → ASSIGNED
    let currentStatus = ticket.status;
    if (currentStatus === TicketStatus.ASSIGNED) {
      TicketStatusStateMachine.validateTransition(currentStatus, TicketStatus.OPEN, 'Reassignment');
      currentStatus = TicketStatus.OPEN;
    }

    TicketStatusStateMachine.validateTransition(currentStatus, TicketStatus.ASSIGNED);

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.ASSIGNED,
        assignedToId: dto.technicianId,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({
      event: 'TICKET_ASSIGNED',
      ticketId,
      technicianId: dto.technicianId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_ASSIGNED',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticketId,
      metadata: { technicianId: dto.technicianId, previousStatus: ticket.status },
    });

    return updated;
  }

  // ─── Start Work ─────────────────────────────────────────────────────────────

  /**
   * Transitions a ticket ASSIGNED → IN_PROGRESS.
   */
  async startWork(ticketId: string, actor: ScopedActor): Promise<MaintenanceTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    TicketStatusStateMachine.validateTransition(ticket.status, TicketStatus.IN_PROGRESS);

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.IN_PROGRESS,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({ event: 'TICKET_STARTED', ticketId, actorId: actor.id });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_STARTED',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticketId,
    });

    return updated;
  }

  // ─── Pending Parts ──────────────────────────────────────────────────────────

  /**
   * Transitions a ticket IN_PROGRESS → PENDING_PARTS.
   */
  async pendingParts(
    ticketId: string,
    notes: string | undefined,
    actor: ScopedActor,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    TicketStatusStateMachine.validateTransition(ticket.status, TicketStatus.PENDING_PARTS);

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.PENDING_PARTS,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({
      event: 'TICKET_PENDING_PARTS',
      ticketId,
      notes,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_PENDING_PARTS',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticketId,
      metadata: { notes },
    });

    return updated;
  }

  // ─── Resolve Ticket ─────────────────────────────────────────────────────────

  /**
   * Transitions a ticket IN_PROGRESS → RESOLVED. Sets resolvedAt timestamp.
   * (PENDING_PARTS must go back to IN_PROGRESS before resolving.)
   */
  async resolveTicket(
    ticketId: string,
    notes: string | undefined,
    actor: ScopedActor,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    TicketStatusStateMachine.validateTransition(ticket.status, TicketStatus.RESOLVED);

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({
      event: 'TICKET_RESOLVED',
      ticketId,
      notes,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_RESOLVED',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticketId,
      metadata: { notes },
    });

    return updated;
  }

  // ─── Close Ticket ───────────────────────────────────────────────────────────

  /**
   * Transitions a ticket to CLOSED from any valid state. Sets closedAt timestamp.
   * If the ticket was RESOLVED, also sets the room to VACANT_DIRTY (cleaning needed).
   */
  async closeTicket(
    ticketId: string,
    notes: string | undefined,
    actor: ScopedActor,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.getTicketOrThrow(ticketId);
    const previousStatus = ticket.status;
    TicketStatusStateMachine.validateTransition(previousStatus, TicketStatus.CLOSED);

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log({
      event: 'TICKET_CLOSED',
      ticketId,
      previousStatus,
      notes,
      actorId: actor.id,
    });

    // If ticket was resolved, the repair is done — mark room as VACANT_DIRTY (needs cleaning)
    if (previousStatus === TicketStatus.RESOLVED) {
      const room = await this.prisma.room.findUnique({ where: { id: ticket.roomId } });
      if (room && room.status === RoomStatus.MAINTENANCE_REQUIRED) {
        await this.prisma.room.update({
          where: { id: ticket.roomId },
          data: { status: RoomStatus.VACANT_DIRTY },
        });

        this.logger.log({
          event: 'ROOM_STATUS_CHANGED',
          roomId: ticket.roomId,
          previousStatus: RoomStatus.MAINTENANCE_REQUIRED,
          newStatus: RoomStatus.VACANT_DIRTY,
          source: 'maintenance_ticket_closed',
          ticketId,
        });
      }
    }

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TICKET_CLOSED',
      resource: 'MAINTENANCE_TICKET',
      resourceId: ticketId,
      metadata: { previousStatus, notes },
    });

    return updated;
  }

  // ─── Get Tickets By Room ────────────────────────────────────────────────────

  /**
   * Returns all tickets for a given room, ordered by createdAt DESC.
   */
  async getTicketsByRoom(roomId: string): Promise<MaintenanceTicket[]> {
    return this.prisma.maintenanceTicket.findMany({
      where: { roomId },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async getTicketOrThrow(id: string): Promise<MaintenanceTicket> {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      throw new TicketNotFoundException(id);
    }

    return ticket;
  }
}
