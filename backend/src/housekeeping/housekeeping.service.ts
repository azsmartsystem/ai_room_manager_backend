import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TaskStatusStateMachine } from './task-status.state-machine';
import { RoomStatusStateMachine } from '../properties/room-status.state-machine';
import { TaskNotFoundException } from '../common/exceptions/operations/task-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { HousekeeperNotFoundException } from '../common/exceptions/operations/housekeeper-not-found.exception';
import {
  CreateTaskDto,
  AssignTaskDto,
  CompleteTaskDto,
  InspectTaskDto,
  ListTasksQuery,
} from './dto/housekeeping.dto';
import { HousekeepingTask, Priority, Role, RoomStatus, TaskStatus, Prisma } from '@prisma/client';
import { ScopedActor } from '../properties/properties.service';

// ─── Metrics shape ────────────────────────────────────────────────────────────

export interface HousekeepingMetrics {
  /** Total tasks currently in the PENDING or ASSIGNED state (backlog). */
  backlog: number;
  /** Total completed tasks in the queried period. */
  completedCount: number;
  /** Average turnaround in minutes (startedAt → completedAt). null if no data. */
  avgTurnaroundMinutes: number | null;
  /** Per-housekeeper stats: id, name, completed count, avg turnaround. */
  staffPerformance: {
    userId: string;
    fullName: string;
    completedTasks: number;
    avgTurnaroundMinutes: number | null;
  }[];
}

// ─── Include shape reused across queries ──────────────────────────────────────

const TASK_INCLUDE = {
  room: { select: { id: true, number: true, propertyId: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
  inspectedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
} satisfies Prisma.HousekeepingTaskInclude;

@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Create Task ────────────────────────────────────────────────────────────

  /**
   * Creates a new PENDING housekeeping task for a given room.
   * The room must exist. Any room status is accepted (supervisors may pre-schedule
   * tasks for rooms that are still occupied or about to check out).
   */
  async createTask(dto: CreateTaskDto, actor: ScopedActor): Promise<HousekeepingTask> {
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) {
      throw new RoomNotFoundException(dto.roomId);
    }

    const task = await this.prisma.housekeepingTask.create({
      data: {
        roomId: dto.roomId,
        priority: (dto.priority as Priority) ?? Priority.MEDIUM,
        notes: dto.notes,
      },
      include: TASK_INCLUDE,
    });

    this.logger.log({
      event: 'HOUSEKEEPING_TASK_CREATED',
      taskId: task.id,
      roomId: dto.roomId,
      priority: task.priority,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'HOUSEKEEPING_TASK_CREATED',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: task.id,
      metadata: { roomId: dto.roomId, priority: task.priority },
    });

    return task;
  }

  // ─── Assign Task ────────────────────────────────────────────────────────────

  /**
   * Assigns (or re-assigns) a task to a HOUSEKEEPING-role user.
   * Reassignment pivots through PENDING first.
   */
  async assignTask(
    taskId: string,
    dto: AssignTaskDto,
    actor: ScopedActor,
  ): Promise<HousekeepingTask> {
    const task = await this.getTaskOrThrow(taskId);

    const housekeeper = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!housekeeper || housekeeper.role !== Role.HOUSEKEEPING) {
      throw new HousekeeperNotFoundException(dto.assignedToId);
    }

    // Reassignment: pivot through PENDING → ASSIGNED
    let currentStatus = task.status;
    if (currentStatus === TaskStatus.ASSIGNED) {
      TaskStatusStateMachine.validateTransition(currentStatus, TaskStatus.PENDING, 'Reassignment');
      currentStatus = TaskStatus.PENDING;
    }

    TaskStatusStateMachine.validateTransition(currentStatus, TaskStatus.ASSIGNED);

    const updated = await this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.ASSIGNED,
        assignedToId: dto.assignedToId,
      },
      include: TASK_INCLUDE,
    });

    this.logger.log({
      event: 'HOUSEKEEPING_TASK_ASSIGNED',
      taskId,
      assignedToId: dto.assignedToId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'HOUSEKEEPING_TASK_ASSIGNED',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: taskId,
      metadata: { assignedToId: dto.assignedToId, previousStatus: task.status },
    });

    return updated;
  }

  // ─── Start Task ─────────────────────────────────────────────────────────────

  /**
   * Marks a task as IN_PROGRESS and records `startedAt`.
   */
  async startTask(taskId: string, actor: ScopedActor): Promise<HousekeepingTask> {
    const task = await this.getTaskOrThrow(taskId);
    TaskStatusStateMachine.validateTransition(task.status, TaskStatus.IN_PROGRESS);

    const updated = await this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: TASK_INCLUDE,
    });

    this.logger.log({ event: 'HOUSEKEEPING_TASK_STARTED', taskId, actorId: actor.id });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'HOUSEKEEPING_TASK_STARTED',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: taskId,
    });

    return updated;
  }

  // ─── Submit for Inspection ──────────────────────────────────────────────────

  /**
   * Housekeeper submits completed cleaning for supervisor sign-off.
   * Transitions: IN_PROGRESS → INSPECTION.
   */
  async submitForInspection(
    taskId: string,
    dto: CompleteTaskDto,
    actor: ScopedActor,
  ): Promise<HousekeepingTask> {
    const task = await this.getTaskOrThrow(taskId);
    TaskStatusStateMachine.validateTransition(task.status, TaskStatus.INSPECTION);

    const updated = await this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.INSPECTION,
        notes: dto.notes ?? task.notes,
      },
      include: TASK_INCLUDE,
    });

    this.logger.log({
      event: 'HOUSEKEEPING_TASK_SUBMITTED_FOR_INSPECTION',
      taskId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'HOUSEKEEPING_TASK_SUBMITTED_FOR_INSPECTION',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: taskId,
    });

    return updated;
  }

  // ─── Inspect Task ───────────────────────────────────────────────────────────

  /**
   * Supervisor performs final quality inspection.
   * - passed = true  → COMPLETED; room promoted to VACANT_CLEAN
   * - passed = false → IN_PROGRESS (re-clean required)
   */
  async inspectTask(
    taskId: string,
    dto: InspectTaskDto,
    actor: ScopedActor,
  ): Promise<HousekeepingTask> {
    const task = await this.getTaskOrThrow(taskId);

    const targetStatus = dto.passed ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS;
    TaskStatusStateMachine.validateTransition(task.status, targetStatus);

    const now = new Date();

    const updated = await this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: targetStatus,
        inspectedById: actor.id,
        inspectedAt: now,
        completedAt: dto.passed ? now : undefined,
        notes: dto.notes ?? task.notes,
      },
      include: TASK_INCLUDE,
    });

    this.logger.log({
      event: dto.passed
        ? 'HOUSEKEEPING_TASK_INSPECTION_PASSED'
        : 'HOUSEKEEPING_TASK_INSPECTION_FAILED',
      taskId,
      roomId: task.roomId,
      passed: dto.passed,
      actorId: actor.id,
    });

    // Promote room to VACANT_CLEAN when inspection passes
    if (dto.passed) {
      const room = await this.prisma.room.findUnique({ where: { id: task.roomId } });
      if (room && RoomStatusStateMachine.canTransition(room.status, RoomStatus.VACANT_CLEAN)) {
        await this.prisma.room.update({
          where: { id: task.roomId },
          data: { status: RoomStatus.VACANT_CLEAN },
        });

        this.logger.log({
          event: 'ROOM_STATUS_CHANGED',
          roomId: task.roomId,
          previousStatus: room.status,
          newStatus: RoomStatus.VACANT_CLEAN,
          source: 'housekeeping_inspection',
          taskId,
        });
      }
    }

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.passed ? 'HOUSEKEEPING_INSPECTION_PASSED' : 'HOUSEKEEPING_INSPECTION_FAILED',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: taskId,
      metadata: { passed: dto.passed, roomId: task.roomId },
    });

    return updated;
  }

  // ─── Cancel Task ────────────────────────────────────────────────────────────

  /**
   * Cancels a task that has not yet reached COMPLETED or is already CANCELLED.
   */
  async cancelTask(taskId: string, actor: ScopedActor): Promise<HousekeepingTask> {
    const task = await this.getTaskOrThrow(taskId);
    TaskStatusStateMachine.validateTransition(task.status, TaskStatus.CANCELLED);

    const updated = await this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
      include: TASK_INCLUDE,
    });

    this.logger.log({ event: 'HOUSEKEEPING_TASK_CANCELLED', taskId, actorId: actor.id });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'HOUSEKEEPING_TASK_CANCELLED',
      resource: 'HOUSEKEEPING_TASK',
      resourceId: taskId,
    });

    return updated;
  }

  // ─── List Tasks ─────────────────────────────────────────────────────────────

  /**
   * Returns tasks scoped to a property, with optional status / assignee / room filters.
   */
  async listTasks(propertyId: string, query: ListTasksQuery): Promise<HousekeepingTask[]> {
    const where: Prisma.HousekeepingTaskWhereInput = {
      room: { propertyId },
    };

    if (query.status) where.status = query.status as TaskStatus;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.roomId) where.roomId = query.roomId;

    return this.prisma.housekeepingTask.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ─── Get Task By ID ─────────────────────────────────────────────────────────

  async getTaskById(id: string): Promise<HousekeepingTask> {
    return this.getTaskOrThrow(id);
  }

  // ─── Operational Metrics ────────────────────────────────────────────────────

  /**
   * Returns operational housekeeping metrics for a property:
   * backlog count, completed count, avg turnaround time, and per-staff performance.
   */
  async getMetrics(propertyId: string): Promise<HousekeepingMetrics> {
    const [backlog, allCompleted] = await Promise.all([
      this.prisma.housekeepingTask.count({
        where: {
          room: { propertyId },
          status: { in: [TaskStatus.PENDING, TaskStatus.ASSIGNED] },
        },
      }),
      this.prisma.housekeepingTask.findMany({
        where: {
          room: { propertyId },
          status: TaskStatus.COMPLETED,
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: {
          assignedToId: true,
          startedAt: true,
          completedAt: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const completedCount = allCompleted.length;

    const avgTurnaroundMinutes =
      completedCount === 0
        ? null
        : allCompleted.reduce((sum, t) => {
            const ms = (t.completedAt as Date).getTime() - (t.startedAt as Date).getTime();
            return sum + ms / 60000;
          }, 0) / completedCount;

    const staffMap = new Map<string, { fullName: string; totalMs: number; count: number }>();

    for (const t of allCompleted) {
      if (!t.assignedToId || !t.assignedTo) continue;
      const ms = (t.completedAt as Date).getTime() - (t.startedAt as Date).getTime();
      const existing = staffMap.get(t.assignedToId);
      if (existing) {
        existing.totalMs += ms;
        existing.count += 1;
      } else {
        staffMap.set(t.assignedToId, {
          fullName: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`,
          totalMs: ms,
          count: 1,
        });
      }
    }

    const staffPerformance = [...staffMap.entries()].map(([userId, data]) => ({
      userId,
      fullName: data.fullName,
      completedTasks: data.count,
      avgTurnaroundMinutes: data.count > 0 ? data.totalMs / data.count / 60000 : null,
    }));

    return {
      backlog,
      completedCount,
      avgTurnaroundMinutes: avgTurnaroundMinutes ?? null,
      staffPerformance,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async getTaskOrThrow(id: string): Promise<HousekeepingTask> {
    const task = await this.prisma.housekeepingTask.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new TaskNotFoundException(id);
    }

    return task;
  }
}
