import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MaintenanceService } from './maintainance.service';
import {
  CreateTicketDtoSchema,
  AssignTicketDtoSchema,
  UpdateTicketStatusDtoSchema,
  CreateTicketDto,
  AssignTicketDto,
  UpdateTicketStatusDto,
  ListTicketsQuery,
} from './dto/maintenance.dto';
import { TypeBoxValidationPipe } from '../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ScopedActor } from '../properties/properties.service';

@ApiTags('Maintenance')
@ApiBearerAuth('jwt-access')
@Controller('properties/:propertyId/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private getActor(user: AuthenticatedUser): ScopedActor {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };
  }

  // ─── Create Ticket ────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK, Role.MAINTENANCE, Role.SECURITY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a maintenance ticket',
    description: 'Creates a new OPEN maintenance ticket for a room.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiBody({
    description: 'Ticket creation payload',
    schema: {
      type: 'object',
      required: ['roomId', 'title', 'description', 'category'],
      properties: {
        roomId: { type: 'string', format: 'uuid', example: 'room-uuid' },
        title: { type: 'string', example: 'Leaking faucet in bathroom' },
        description: { type: 'string', example: 'The bathroom faucet is dripping constantly.' },
        category: { type: 'string', example: 'Plumbing' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Ticket created and in OPEN state.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async createTicket(
    @Param('propertyId') propertyId: string,
    @Body(new TypeBoxValidationPipe(CreateTicketDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.createTicket(dto as CreateTicketDto, this.getActor(user));
  }

  // ─── List Tickets ─────────────────────────────────────────────────────────────

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({
    summary: 'List maintenance tickets',
    description: 'Returns tickets for the given property with optional filters.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Filter by room UUID' })
  @ApiQuery({ name: 'assignedToId', required: false, description: 'Filter by technician UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'RESOLVED', 'CLOSED'],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  })
  @ApiResponse({ status: 200, description: 'Ticket list returned.' })
  async listTickets(
    @Param('propertyId') propertyId: string,
    @Query('roomId') roomId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.maintenanceService.listTickets({
      propertyId,
      roomId,
      assignedToId,
      status: status as ListTicketsQuery['status'],
      priority: priority as ListTicketsQuery['priority'],
    });
  }

  // ─── Get Ticket ───────────────────────────────────────────────────────────────

  @Get('tickets/:ticketId')
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({ summary: 'Get a single maintenance ticket' })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket detail returned.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  async getTicket(@Param('ticketId') ticketId: string) {
    return this.maintenanceService.getTicket(ticketId);
  }

  // ─── Assign Ticket ────────────────────────────────────────────────────────────

  @Patch('tickets/:ticketId/assign')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Assign a maintenance ticket to a technician',
    description: 'Transitions OPEN → ASSIGNED. Re-assignment is supported.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['technicianId'],
      properties: {
        technicianId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the MAINTENANCE user',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ticket assigned.' })
  @ApiResponse({ status: 404, description: 'Ticket or technician not found.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async assignTicket(
    @Param('ticketId') ticketId: string,
    @Body(new TypeBoxValidationPipe(AssignTicketDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.assignTicket(
      ticketId,
      dto as AssignTicketDto,
      this.getActor(user),
    );
  }

  // ─── Start Work ───────────────────────────────────────────────────────────────

  @Patch('tickets/:ticketId/start')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.MAINTENANCE)
  @ApiOperation({
    summary: 'Start work on a ticket',
    description: 'Transitions ASSIGNED → IN_PROGRESS.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Work started.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async startWork(@Param('ticketId') ticketId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.startWork(ticketId, this.getActor(user));
  }

  // ─── Pending Parts ────────────────────────────────────────────────────────────

  @Patch('tickets/:ticketId/pending-parts')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.MAINTENANCE)
  @ApiOperation({
    summary: 'Mark ticket as pending parts',
    description: 'Transitions IN_PROGRESS → PENDING_PARTS.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Notes about which parts are needed' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ticket pending parts.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async pendingParts(
    @Param('ticketId') ticketId: string,
    @Body(new TypeBoxValidationPipe(UpdateTicketStatusDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const typedDto = dto as UpdateTicketStatusDto;
    return this.maintenanceService.pendingParts(ticketId, typedDto.notes, this.getActor(user));
  }

  // ─── Resolve Ticket ───────────────────────────────────────────────────────────

  @Patch('tickets/:ticketId/resolve')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.MAINTENANCE)
  @ApiOperation({
    summary: 'Resolve a maintenance ticket',
    description: 'Transitions IN_PROGRESS → RESOLVED. Sets resolvedAt timestamp.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Resolution notes' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ticket resolved.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async resolveTicket(
    @Param('ticketId') ticketId: string,
    @Body(new TypeBoxValidationPipe(UpdateTicketStatusDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const typedDto = dto as UpdateTicketStatusDto;
    return this.maintenanceService.resolveTicket(ticketId, typedDto.notes, this.getActor(user));
  }

  // ─── Close Ticket ─────────────────────────────────────────────────────────────

  @Patch('tickets/:ticketId/close')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Close a maintenance ticket',
    description:
      'Transitions to CLOSED from any valid state. If ticket was RESOLVED, room is set to VACANT_DIRTY.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Closing notes' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ticket closed.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async closeTicket(
    @Param('ticketId') ticketId: string,
    @Body(new TypeBoxValidationPipe(UpdateTicketStatusDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const typedDto = dto as UpdateTicketStatusDto;
    return this.maintenanceService.closeTicket(ticketId, typedDto.notes, this.getActor(user));
  }

  // ─── Get Tickets By Room ──────────────────────────────────────────────────────

  @Get('rooms/:roomId/tickets')
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({ summary: 'List all tickets for a specific room' })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room ticket list returned.' })
  async getTicketsByRoom(@Param('roomId') roomId: string) {
    return this.maintenanceService.getTicketsByRoom(roomId);
  }
}
