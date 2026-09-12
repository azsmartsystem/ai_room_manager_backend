import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintainance.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, Priority, Role, RoomStatus } from '@prisma/client';
import { TicketNotFoundException } from '../common/exceptions/operations/ticket-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { HousekeeperNotFoundException } from '../common/exceptions/operations/housekeeper-not-found.exception';
import { InvalidTicketStateTransitionException } from '../common/exceptions/operations/invalid-ticket-state-transition.exception';
import { CreateTicketDto, AssignTicketDto } from './dto/maintenance.dto';
import { ScopedActor } from '../properties/properties.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockActor: ScopedActor = {
  id: 'actor-uuid',
  email: 'manager@test.com',
  role: Role.PROPERTY_MANAGER,
  propertyId: 'prop-uuid',
};

const makeTicket = (
  overrides: Partial<{
    id: string;
    roomId: string;
    status: TicketStatus;
    assignedToId: string | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    priority: Priority;
  }> = {},
) => ({
  id: 'ticket-uuid',
  roomId: 'room-uuid',
  status: TicketStatus.OPEN,
  priority: Priority.MEDIUM,
  assignedToId: null,
  title: 'Broken AC',
  description: 'The air conditioning unit is not working at all.',
  category: 'HVAC',
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  room: { id: 'room-uuid', number: '101', propertyId: 'prop-uuid' },
  assignedTo: null,
  ...overrides,
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  room: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  maintenanceTicket: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    jest.clearAllMocks();
  });

  // ─── createTicket ────────────────────────────────────────────────────────

  describe('createTicket', () => {
    const dto: CreateTicketDto = {
      roomId: 'room-uuid',
      title: 'Broken AC',
      description: 'The air conditioning unit is not working at all.',
      category: 'HVAC',
    };

    it('creates a ticket with default MEDIUM priority', async () => {
      const room = { id: 'room-uuid', status: RoomStatus.OCCUPIED_DIRTY };
      mockPrisma.room.findUnique.mockResolvedValue(room);
      const ticket = makeTicket();
      mockPrisma.maintenanceTicket.create.mockResolvedValue(ticket);

      const result = await service.createTicket(dto, mockActor);

      expect(result).toEqual(ticket);
      expect(mockPrisma.maintenanceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roomId: 'room-uuid', priority: Priority.MEDIUM }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_CREATED' }),
      );
    });

    it('uses the provided priority', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-uuid' });
      mockPrisma.maintenanceTicket.create.mockResolvedValue(
        makeTicket({ priority: Priority.HIGH }),
      );

      await service.createTicket({ ...dto, priority: 'HIGH' }, mockActor);

      expect(mockPrisma.maintenanceTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: Priority.HIGH }),
        }),
      );
    });

    it('throws RoomNotFoundException when room does not exist', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(service.createTicket(dto, mockActor)).rejects.toThrow(RoomNotFoundException);
    });
  });

  // ─── listTickets ─────────────────────────────────────────────────────────

  describe('listTickets', () => {
    it('returns all tickets without filters', async () => {
      const tickets = [makeTicket(), makeTicket({ id: 'ticket-2' })];
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue(tickets);

      const result = await service.listTickets({});

      expect(result).toHaveLength(2);
    });

    it('applies propertyId filter when provided', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      await service.listTickets({ propertyId: 'prop-uuid' });

      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ room: { propertyId: 'prop-uuid' } }),
        }),
      );
    });

    it('applies roomId filter when provided', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      await service.listTickets({ roomId: 'room-uuid' });

      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ roomId: 'room-uuid' }),
        }),
      );
    });

    it('applies status filter when provided', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      await service.listTickets({ status: 'ASSIGNED' });

      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TicketStatus.ASSIGNED }),
        }),
      );
    });

    it('applies priority filter when provided', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      await service.listTickets({ priority: 'HIGH' });

      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: Priority.HIGH }),
        }),
      );
    });

    it('applies assignedToId filter when provided', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      await service.listTickets({ assignedToId: 'tech-uuid' });

      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: 'tech-uuid' }),
        }),
      );
    });
  });

  // ─── getTicket ───────────────────────────────────────────────────────────

  describe('getTicket', () => {
    it('returns a ticket by id', async () => {
      const ticket = makeTicket();
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(ticket);

      const result = await service.getTicket('ticket-uuid');

      expect(result).toEqual(ticket);
    });

    it('throws TicketNotFoundException when not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.getTicket('bad-id')).rejects.toThrow(TicketNotFoundException);
    });
  });

  // ─── assignTicket ────────────────────────────────────────────────────────

  describe('assignTicket', () => {
    const dto: AssignTicketDto = { technicianId: 'tech-uuid' };

    it('assigns an OPEN ticket to a MAINTENANCE technician', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.OPEN }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'tech-uuid', role: Role.MAINTENANCE });
      const assigned = makeTicket({ status: TicketStatus.ASSIGNED, assignedToId: 'tech-uuid' });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(assigned);

      const result = await service.assignTicket('ticket-uuid', dto, mockActor);

      expect(result.status).toBe(TicketStatus.ASSIGNED);
      expect(mockPrisma.maintenanceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.ASSIGNED,
            assignedToId: 'tech-uuid',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_ASSIGNED' }),
      );
    });

    it('re-assigns an ASSIGNED ticket by pivoting through OPEN', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.ASSIGNED }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'tech-uuid', role: Role.MAINTENANCE });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(
        makeTicket({ status: TicketStatus.ASSIGNED, assignedToId: 'tech-uuid' }),
      );

      await expect(service.assignTicket('ticket-uuid', dto, mockActor)).resolves.toBeDefined();
    });

    it('throws TicketNotFoundException when ticket not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.assignTicket('bad-id', dto, mockActor)).rejects.toThrow(
        TicketNotFoundException,
      );
    });

    it('throws HousekeeperNotFoundException when technician not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(makeTicket());
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assignTicket('ticket-uuid', dto, mockActor)).rejects.toThrow(
        HousekeeperNotFoundException,
      );
    });

    it('throws HousekeeperNotFoundException when user lacks MAINTENANCE role', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(makeTicket());
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'tech-uuid', role: Role.FRONT_DESK });

      await expect(service.assignTicket('ticket-uuid', dto, mockActor)).rejects.toThrow(
        HousekeeperNotFoundException,
      );
    });

    it('throws InvalidTicketStateTransitionException when ticket is CLOSED', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.CLOSED }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'tech-uuid', role: Role.MAINTENANCE });

      await expect(service.assignTicket('ticket-uuid', dto, mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });
  });

  // ─── startWork ───────────────────────────────────────────────────────────

  describe('startWork', () => {
    it('transitions ASSIGNED → IN_PROGRESS', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.ASSIGNED }),
      );
      const startedTicket = makeTicket({ status: TicketStatus.IN_PROGRESS });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(startedTicket);

      const result = await service.startWork('ticket-uuid', mockActor);

      expect(result.status).toBe(TicketStatus.IN_PROGRESS);
      expect(mockPrisma.maintenanceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TicketStatus.IN_PROGRESS }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_STARTED' }),
      );
    });

    it('throws TicketNotFoundException when ticket not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.startWork('bad-id', mockActor)).rejects.toThrow(TicketNotFoundException);
    });

    it('throws InvalidTicketStateTransitionException when ticket is OPEN (not yet assigned)', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.OPEN }),
      );

      await expect(service.startWork('ticket-uuid', mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });
  });

  // ─── pendingParts ────────────────────────────────────────────────────────

  describe('pendingParts', () => {
    it('transitions IN_PROGRESS → PENDING_PARTS', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.IN_PROGRESS }),
      );
      const pendingTicket = makeTicket({ status: TicketStatus.PENDING_PARTS });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(pendingTicket);

      const result = await service.pendingParts(
        'ticket-uuid',
        'Need replacement filter',
        mockActor,
      );

      expect(result.status).toBe(TicketStatus.PENDING_PARTS);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_PENDING_PARTS' }),
      );
    });

    it('throws InvalidTicketStateTransitionException when ticket is OPEN', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.OPEN }),
      );

      await expect(service.pendingParts('ticket-uuid', undefined, mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });

    it('throws TicketNotFoundException when ticket not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.pendingParts('bad-id', undefined, mockActor)).rejects.toThrow(
        TicketNotFoundException,
      );
    });
  });

  // ─── resolveTicket ───────────────────────────────────────────────────────

  describe('resolveTicket', () => {
    it('transitions IN_PROGRESS → RESOLVED and sets resolvedAt', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.IN_PROGRESS }),
      );
      const resolvedTicket = makeTicket({ status: TicketStatus.RESOLVED, resolvedAt: new Date() });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(resolvedTicket);

      const result = await service.resolveTicket('ticket-uuid', 'Fixed the issue', mockActor);

      expect(result.status).toBe(TicketStatus.RESOLVED);
      expect(mockPrisma.maintenanceTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.RESOLVED,
            resolvedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_RESOLVED' }),
      );
    });

    it('throws InvalidTicketStateTransitionException when ticket is PENDING_PARTS (must go to IN_PROGRESS first)', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.PENDING_PARTS }),
      );

      await expect(service.resolveTicket('ticket-uuid', undefined, mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });

    it('throws InvalidTicketStateTransitionException when ticket is OPEN', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.OPEN }),
      );

      await expect(service.resolveTicket('ticket-uuid', undefined, mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });

    it('throws TicketNotFoundException when ticket not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.resolveTicket('bad-id', undefined, mockActor)).rejects.toThrow(
        TicketNotFoundException,
      );
    });
  });

  // ─── closeTicket ─────────────────────────────────────────────────────────

  describe('closeTicket', () => {
    it('closes a RESOLVED ticket and sets room to VACANT_DIRTY when room is MAINTENANCE_REQUIRED', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.RESOLVED }),
      );
      const closedTicket = makeTicket({ status: TicketStatus.CLOSED, closedAt: new Date() });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(closedTicket);
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.MAINTENANCE_REQUIRED,
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.VACANT_DIRTY,
      });

      const result = await service.closeTicket('ticket-uuid', 'All done', mockActor);

      expect(result.status).toBe(TicketStatus.CLOSED);
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RoomStatus.VACANT_DIRTY } }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TICKET_CLOSED' }),
      );
    });

    it('closes a RESOLVED ticket but skips room update when room is not MAINTENANCE_REQUIRED', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.RESOLVED }),
      );
      const closedTicket = makeTicket({ status: TicketStatus.CLOSED, closedAt: new Date() });
      mockPrisma.maintenanceTicket.update.mockResolvedValue(closedTicket);
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.OCCUPIED_DIRTY,
      });

      await service.closeTicket('ticket-uuid', undefined, mockActor);

      expect(mockPrisma.room.update).not.toHaveBeenCalled();
    });

    it('closes an OPEN ticket without touching room status', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.OPEN }),
      );
      mockPrisma.maintenanceTicket.update.mockResolvedValue(
        makeTicket({ status: TicketStatus.CLOSED }),
      );

      await service.closeTicket('ticket-uuid', undefined, mockActor);

      expect(mockPrisma.room.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.room.update).not.toHaveBeenCalled();
    });

    it('closes an ASSIGNED ticket without touching room status', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.ASSIGNED }),
      );
      mockPrisma.maintenanceTicket.update.mockResolvedValue(
        makeTicket({ status: TicketStatus.CLOSED }),
      );

      await service.closeTicket('ticket-uuid', undefined, mockActor);

      expect(mockPrisma.room.update).not.toHaveBeenCalled();
    });

    it('throws InvalidTicketStateTransitionException when ticket is already CLOSED', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(
        makeTicket({ status: TicketStatus.CLOSED }),
      );

      await expect(service.closeTicket('ticket-uuid', undefined, mockActor)).rejects.toThrow(
        InvalidTicketStateTransitionException,
      );
    });

    it('throws TicketNotFoundException when ticket not found', async () => {
      mockPrisma.maintenanceTicket.findUnique.mockResolvedValue(null);

      await expect(service.closeTicket('bad-id', undefined, mockActor)).rejects.toThrow(
        TicketNotFoundException,
      );
    });
  });

  // ─── getTicketsByRoom ─────────────────────────────────────────────────────

  describe('getTicketsByRoom', () => {
    it('returns all tickets for a room ordered by createdAt DESC', async () => {
      const ticket1 = makeTicket();
      const ticket2 = makeTicket({ id: 'ticket-2' });
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([ticket1, ticket2]);

      const result = await service.getTicketsByRoom('room-uuid');

      expect(result).toHaveLength(2);
      expect(mockPrisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: 'room-uuid' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('returns an empty list when no tickets exist for the room', async () => {
      mockPrisma.maintenanceTicket.findMany.mockResolvedValue([]);

      const result = await service.getTicketsByRoom('empty-room-uuid');

      expect(result).toHaveLength(0);
    });
  });
});
