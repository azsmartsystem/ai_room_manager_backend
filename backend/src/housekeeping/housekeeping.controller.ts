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
import { HousekeepingService } from './housekeeping.service';
import {
  CreateTaskDtoSchema,
  AssignTaskDtoSchema,
  CompleteTaskDtoSchema,
  InspectTaskDtoSchema,
  CreateTaskDto,
  AssignTaskDto,
  CompleteTaskDto,
  InspectTaskDto,
  ListTasksQuery,
} from './dto/housekeeping.dto';
import { TypeBoxValidationPipe } from '../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ScopedActor } from '../properties/properties.service';

@ApiTags('Housekeeping')
@ApiBearerAuth('jwt-access')
@Controller('properties/:propertyId/housekeeping')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  private getActor(user: AuthenticatedUser): ScopedActor {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };
  }

  // ─── Create Task ─────────────────────────────────────────────────────────────

  @Post('tasks')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a housekeeping task',
    description:
      'Creates a new PENDING housekeeping task for a room. A task may be pre-scheduled for a room in any state (e.g. still OCCUPIED before checkout).',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiBody({
    description: 'Task creation payload',
    schema: {
      type: 'object',
      required: ['roomId'],
      properties: {
        roomId: { type: 'string', format: 'uuid', example: 'room-uuid' },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          example: 'HIGH',
        },
        notes: { type: 'string', example: 'Deep clean required — previous guest stayed 14 days.' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Task created and in PENDING state.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async createTask(
    @Param('propertyId') _propertyId: string,
    @Body(new TypeBoxValidationPipe(CreateTaskDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.createTask(dto as CreateTaskDto, this.getActor(user));
  }

  // ─── List Tasks

  @Get('tasks')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK, Role.HOUSEKEEPING, Role.SECURITY)
  @ApiOperation({
    summary: 'List housekeeping tasks for a property',
    description: 'Returns all tasks for the given property, with optional filters.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'INSPECTION', 'COMPLETED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'assignedToId', required: false, description: 'Filter by housekeeper UUID' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Filter by room UUID' })
  @ApiResponse({ status: 200, description: 'Task list returned.' })
  async listTasks(
    @Param('propertyId') propertyId: string,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.housekeepingService.listTasks(propertyId, {
      status: status as ListTasksQuery['status'],
      assignedToId,
      roomId,
    });
  }

  // ─── Get Task ────────────────────────────────────────────────────────────────

  @Get('tasks/:taskId')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK, Role.HOUSEKEEPING, Role.SECURITY)
  @ApiOperation({ summary: 'Get a single housekeeping task' })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task detail returned.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  async getTask(@Param('taskId') taskId: string) {
    return this.housekeepingService.getTaskById(taskId);
  }

  // ─── Assign Task ─────────────────────────────────────────────────────────────

  @Patch('tasks/:taskId/assign')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Assign (or re-assign) a task to a housekeeper',
    description:
      'Transitions PENDING → ASSIGNED. Re-assignment is supported (pivots through PENDING automatically).',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['assignedToId'],
      properties: {
        assignedToId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the HOUSEKEEPING user to assign',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task assigned.' })
  @ApiResponse({ status: 404, description: 'Task or housekeeper not found.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async assignTask(
    @Param('taskId') taskId: string,
    @Body(new TypeBoxValidationPipe(AssignTaskDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.assignTask(taskId, dto as AssignTaskDto, this.getActor(user));
  }

  // ─── Start Task ──────────────────────────────────────────────────────────────

  @Patch('tasks/:taskId/start')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.HOUSEKEEPING)
  @ApiOperation({
    summary: 'Start a task (housekeeper begins cleaning)',
    description: 'Transitions ASSIGNED → IN_PROGRESS and records startedAt timestamp.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task started.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async startTask(@Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingService.startTask(taskId, this.getActor(user));
  }

  // ─── Submit for Inspection ───────────────────────────────────────────────────

  @Patch('tasks/:taskId/submit')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.HOUSEKEEPING)
  @ApiOperation({
    summary: 'Submit task for supervisor inspection',
    description: 'Housekeeper marks cleaning done. Transitions IN_PROGRESS → INSPECTION.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Completion notes from the housekeeper' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task submitted for inspection.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async submitForInspection(
    @Param('taskId') taskId: string,
    @Body(new TypeBoxValidationPipe(CompleteTaskDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.submitForInspection(
      taskId,
      dto as CompleteTaskDto,
      this.getActor(user),
    );
  }

  // ─── Inspect Task ────────────────────────────────────────────────────────────

  @Patch('tasks/:taskId/inspect')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Supervisor inspection sign-off',
    description:
      '**Pass:** Transitions INSPECTION → COMPLETED and promotes room to VACANT_CLEAN.\n\n**Fail:** Transitions INSPECTION → IN_PROGRESS for re-clean.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['passed'],
      properties: {
        passed: { type: 'boolean', description: 'true = pass, false = fail' },
        notes: { type: 'string', description: 'Supervisor inspection notes' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Inspection recorded.' })
  @ApiResponse({ status: 422, description: 'Invalid state transition.' })
  async inspectTask(
    @Param('taskId') taskId: string,
    @Body(new TypeBoxValidationPipe(InspectTaskDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.inspectTask(taskId, dto as InspectTaskDto, this.getActor(user));
  }

  // ─── Cancel Task ─────────────────────────────────────────────────────────────

  @Patch('tasks/:taskId/cancel')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Cancel a housekeeping task',
    description: 'Cancels a task that is not yet COMPLETED.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task cancelled.' })
  @ApiResponse({ status: 422, description: 'Cannot cancel a completed task.' })
  async cancelTask(@Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingService.cancelTask(taskId, this.getActor(user));
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  @Get('metrics')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Get housekeeping operational metrics',
    description:
      'Returns backlog count, completed task count, average turnaround time, and per-staff performance stats.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiResponse({
    status: 200,
    description: 'Metrics returned.',
    schema: {
      type: 'object',
      properties: {
        backlog: { type: 'number', description: 'Tasks in PENDING or ASSIGNED state' },
        completedCount: { type: 'number', description: 'Total COMPLETED tasks' },
        avgTurnaroundMinutes: {
          type: 'number',
          nullable: true,
          description: 'Average cleaning time in minutes',
        },
        staffPerformance: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              fullName: { type: 'string' },
              completedTasks: { type: 'number' },
              avgTurnaroundMinutes: { type: 'number', nullable: true },
            },
          },
        },
      },
    },
  })
  async getMetrics(@Param('propertyId') propertyId: string) {
    return this.housekeepingService.getMetrics(propertyId);
  }
}
