import { Test, TestingModule } from '@nestjs/testing';
import { HousekeepingService } from './housekeeping.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TaskStatus, Priority, Role, RoomStatus } from '@prisma/client';
import { TaskNotFoundException } from '../common/exceptions/operations/task-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { HousekeeperNotFoundException } from '../common/exceptions/operations/housekeeper-not-found.exception';
import { InvalidTaskStateTransitionException } from '../common/exceptions/operations/invalid-task-state-transition.exception';
import {
  CreateTaskDto,
  AssignTaskDto,
  CompleteTaskDto,
  InspectTaskDto,
} from './dto/housekeeping.dto';
import { ScopedActor } from '../properties/properties.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockActor: ScopedActor = {
  id: 'actor-uuid',
  email: 'manager@test.com',
  role: Role.PROPERTY_MANAGER,
  propertyId: 'prop-uuid',
};

const makeTask = (
  overrides: Partial<{
    id: string;
    roomId: string;
    status: TaskStatus;
    assignedToId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    inspectedAt: Date | null;
    notes: string | null;
  }> = {},
) => ({
  id: 'task-uuid',
  roomId: 'room-uuid',
  status: TaskStatus.PENDING,
  priority: Priority.MEDIUM,
  assignedToId: null,
  inspectedById: null,
  startedAt: null,
  completedAt: null,
  inspectedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  room: { id: 'room-uuid', number: '101', propertyId: 'prop-uuid' },
  assignedTo: null,
  inspectedBy: null,
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
  housekeepingTask: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('HousekeepingService', () => {
  let service: HousekeepingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<HousekeepingService>(HousekeepingService);

    jest.clearAllMocks();
  });

  // ─── createTask ────────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates a task with default MEDIUM priority', async () => {
      const room = { id: 'room-uuid', status: RoomStatus.VACANT_DIRTY };
      mockPrisma.room.findUnique.mockResolvedValue(room);
      const task = makeTask();
      mockPrisma.housekeepingTask.create.mockResolvedValue(task);

      const dto: CreateTaskDto = { roomId: 'room-uuid' };
      const result = await service.createTask(dto, mockActor);

      expect(result).toEqual(task);
      expect(mockPrisma.housekeepingTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roomId: 'room-uuid', priority: Priority.MEDIUM }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HOUSEKEEPING_TASK_CREATED' }),
      );
    });

    it('uses the provided priority', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-uuid' });
      mockPrisma.housekeepingTask.create.mockResolvedValue(
        makeTask({ status: TaskStatus.PENDING }),
      );

      const dto: CreateTaskDto = { roomId: 'room-uuid', priority: 'HIGH' };
      await service.createTask(dto, mockActor);

      expect(mockPrisma.housekeepingTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: Priority.HIGH }),
        }),
      );
    });

    it('throws RoomNotFoundException when room does not exist', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(service.createTask({ roomId: 'nonexistent' }, mockActor)).rejects.toThrow(
        RoomNotFoundException,
      );
    });
  });

  // ─── assignTask ───────────────────────────────────────────────────────────

  describe('assignTask', () => {
    const dto: AssignTaskDto = { assignedToId: 'hk-uuid' };

    it('assigns a PENDING task to a housekeeper', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.PENDING }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'hk-uuid', role: Role.HOUSEKEEPING });
      mockPrisma.housekeepingTask.update.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToId: 'hk-uuid' }),
      );

      const result = await service.assignTask('task-uuid', dto, mockActor);

      expect(result.status).toBe(TaskStatus.ASSIGNED);
      expect(mockPrisma.housekeepingTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TaskStatus.ASSIGNED, assignedToId: 'hk-uuid' }),
        }),
      );
    });

    it('reassigns an ASSIGNED task by pivoting through PENDING', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'hk-uuid', role: Role.HOUSEKEEPING });
      mockPrisma.housekeepingTask.update.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToId: 'hk-uuid' }),
      );

      // Should succeed without throwing
      await expect(service.assignTask('task-uuid', dto, mockActor)).resolves.toBeDefined();
    });

    it('throws TaskNotFoundException when task not found', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(null);

      await expect(service.assignTask('bad-id', dto, mockActor)).rejects.toThrow(
        TaskNotFoundException,
      );
    });

    it('throws HousekeeperNotFoundException when user not found', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(makeTask());
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assignTask('task-uuid', dto, mockActor)).rejects.toThrow(
        HousekeeperNotFoundException,
      );
    });

    it('throws HousekeeperNotFoundException when user lacks HOUSEKEEPING role', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(makeTask());
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'hk-uuid', role: Role.FRONT_DESK });

      await expect(service.assignTask('task-uuid', dto, mockActor)).rejects.toThrow(
        HousekeeperNotFoundException,
      );
    });

    it('throws InvalidTaskStateTransitionException when task is COMPLETED', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.COMPLETED }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'hk-uuid', role: Role.HOUSEKEEPING });

      await expect(service.assignTask('task-uuid', dto, mockActor)).rejects.toThrow(
        InvalidTaskStateTransitionException,
      );
    });
  });

  // ─── startTask ────────────────────────────────────────────────────────────

  describe('startTask', () => {
    it('transitions ASSIGNED → IN_PROGRESS and sets startedAt', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED }),
      );
      const startedTask = makeTask({ status: TaskStatus.IN_PROGRESS, startedAt: new Date() });
      mockPrisma.housekeepingTask.update.mockResolvedValue(startedTask);

      const result = await service.startTask('task-uuid', mockActor);

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockPrisma.housekeepingTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.IN_PROGRESS,
            startedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws TaskNotFoundException when task not found', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(null);

      await expect(service.startTask('bad-id', mockActor)).rejects.toThrow(TaskNotFoundException);
    });

    it('throws InvalidTaskStateTransitionException when task is PENDING (not yet assigned)', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.PENDING }),
      );

      await expect(service.startTask('task-uuid', mockActor)).rejects.toThrow(
        InvalidTaskStateTransitionException,
      );
    });
  });

  // ─── submitForInspection ──────────────────────────────────────────────────

  describe('submitForInspection', () => {
    const dto: CompleteTaskDto = { notes: 'Room is clean' };

    it('transitions IN_PROGRESS → INSPECTION', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS }),
      );
      const updatedTask = makeTask({ status: TaskStatus.INSPECTION });
      mockPrisma.housekeepingTask.update.mockResolvedValue(updatedTask);

      const result = await service.submitForInspection('task-uuid', dto, mockActor);

      expect(result.status).toBe(TaskStatus.INSPECTION);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HOUSEKEEPING_TASK_SUBMITTED_FOR_INSPECTION' }),
      );
    });

    it('throws InvalidTaskStateTransitionException when task is PENDING', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.PENDING }),
      );

      await expect(service.submitForInspection('task-uuid', dto, mockActor)).rejects.toThrow(
        InvalidTaskStateTransitionException,
      );
    });
  });

  // ─── inspectTask ──────────────────────────────────────────────────────────

  describe('inspectTask', () => {
    it('passes inspection: transitions to COMPLETED and promotes room to VACANT_CLEAN', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.INSPECTION }),
      );
      const completedTask = makeTask({
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        inspectedAt: new Date(),
      });
      mockPrisma.housekeepingTask.update.mockResolvedValue(completedTask);
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.VACANT_DIRTY,
      });
      mockPrisma.room.update.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.VACANT_CLEAN,
      });

      const dto: InspectTaskDto = { passed: true, notes: 'All good' };
      const result = await service.inspectTask('task-uuid', dto, mockActor);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RoomStatus.VACANT_CLEAN } }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HOUSEKEEPING_INSPECTION_PASSED' }),
      );
    });

    it('fails inspection: transitions back to IN_PROGRESS for re-clean', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.INSPECTION }),
      );
      const reCleanTask = makeTask({ status: TaskStatus.IN_PROGRESS });
      mockPrisma.housekeepingTask.update.mockResolvedValue(reCleanTask);

      const dto: InspectTaskDto = { passed: false, notes: 'Missed bathroom' };
      const result = await service.inspectTask('task-uuid', dto, mockActor);

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      // Room should NOT be promoted when inspection fails
      expect(mockPrisma.room.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HOUSEKEEPING_INSPECTION_FAILED' }),
      );
    });

    it('skips room promotion when room cannot transition to VACANT_CLEAN', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.INSPECTION }),
      );
      mockPrisma.housekeepingTask.update.mockResolvedValue(
        makeTask({ status: TaskStatus.COMPLETED }),
      );
      // Room is OCCUPIED_CLEAN — cannot go directly to VACANT_CLEAN
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-uuid',
        status: RoomStatus.OCCUPIED_CLEAN,
      });

      const dto: InspectTaskDto = { passed: true };
      await service.inspectTask('task-uuid', dto, mockActor);

      expect(mockPrisma.room.update).not.toHaveBeenCalled();
    });

    it('throws InvalidTaskStateTransitionException when task is not in INSPECTION', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED }),
      );

      await expect(service.inspectTask('task-uuid', { passed: true }, mockActor)).rejects.toThrow(
        InvalidTaskStateTransitionException,
      );
    });
  });

  // ─── cancelTask ───────────────────────────────────────────────────────────

  describe('cancelTask', () => {
    it('cancels a PENDING task', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.PENDING }),
      );
      const cancelledTask = makeTask({ status: TaskStatus.CANCELLED });
      mockPrisma.housekeepingTask.update.mockResolvedValue(cancelledTask);

      const result = await service.cancelTask('task-uuid', mockActor);

      expect(result.status).toBe(TaskStatus.CANCELLED);
    });

    it('cancels an ASSIGNED task', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED }),
      );
      mockPrisma.housekeepingTask.update.mockResolvedValue(
        makeTask({ status: TaskStatus.CANCELLED }),
      );

      await expect(service.cancelTask('task-uuid', mockActor)).resolves.toBeDefined();
    });

    it('throws InvalidTaskStateTransitionException for a COMPLETED task', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.COMPLETED }),
      );

      await expect(service.cancelTask('task-uuid', mockActor)).rejects.toThrow(
        InvalidTaskStateTransitionException,
      );
    });
  });

  // ─── listTasks ────────────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns all tasks for a property without filters', async () => {
      const tasks = [makeTask(), makeTask({ id: 'task-2' })];
      mockPrisma.housekeepingTask.findMany.mockResolvedValue(tasks);

      const result = await service.listTasks('prop-uuid', {});

      expect(result).toHaveLength(2);
      expect(mockPrisma.housekeepingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { room: { propertyId: 'prop-uuid' } },
        }),
      );
    });

    it('applies status filter when provided', async () => {
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([]);

      await service.listTasks('prop-uuid', { status: 'ASSIGNED' });

      expect(mockPrisma.housekeepingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TaskStatus.ASSIGNED }),
        }),
      );
    });

    it('applies assignedToId filter when provided', async () => {
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([]);

      await service.listTasks('prop-uuid', { assignedToId: 'hk-uuid' });

      expect(mockPrisma.housekeepingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: 'hk-uuid' }),
        }),
      );
    });

    it('applies roomId filter when provided', async () => {
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([]);

      await service.listTasks('prop-uuid', { roomId: 'room-uuid' });

      expect(mockPrisma.housekeepingTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ roomId: 'room-uuid' }),
        }),
      );
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns a task by id', async () => {
      const task = makeTask();
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(task);

      const result = await service.getTaskById('task-uuid');

      expect(result).toEqual(task);
    });

    it('throws TaskNotFoundException when not found', async () => {
      mockPrisma.housekeepingTask.findUnique.mockResolvedValue(null);

      await expect(service.getTaskById('bad-id')).rejects.toThrow(TaskNotFoundException);
    });
  });

  // ─── getMetrics ───────────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('returns zero metrics when no tasks exist', async () => {
      mockPrisma.housekeepingTask.count.mockResolvedValue(0);
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([]);

      const metrics = await service.getMetrics('prop-uuid');

      expect(metrics.backlog).toBe(0);
      expect(metrics.completedCount).toBe(0);
      expect(metrics.avgTurnaroundMinutes).toBeNull();
      expect(metrics.staffPerformance).toHaveLength(0);
    });

    it('computes average turnaround from completed tasks', async () => {
      const startedAt = new Date('2024-01-01T08:00:00Z');
      const completedAt = new Date('2024-01-01T09:00:00Z'); // 60 min

      mockPrisma.housekeepingTask.count.mockResolvedValue(0);
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([
        {
          assignedToId: 'hk-uuid',
          startedAt,
          completedAt,
          assignedTo: { id: 'hk-uuid', firstName: 'Jane', lastName: 'Doe' },
        },
      ]);

      const metrics = await service.getMetrics('prop-uuid');

      expect(metrics.completedCount).toBe(1);
      expect(metrics.avgTurnaroundMinutes).toBe(60);
      expect(metrics.staffPerformance).toHaveLength(1);
      expect(metrics.staffPerformance[0]!.avgTurnaroundMinutes).toBe(60);
      expect(metrics.staffPerformance[0]!.fullName).toBe('Jane Doe');
    });

    it('aggregates multiple tasks per housekeeper', async () => {
      const s1 = new Date('2024-01-01T08:00:00Z');
      const c1 = new Date('2024-01-01T09:00:00Z'); // 60 min
      const s2 = new Date('2024-01-01T10:00:00Z');
      const c2 = new Date('2024-01-01T10:30:00Z'); // 30 min

      mockPrisma.housekeepingTask.count.mockResolvedValue(2);
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([
        {
          assignedToId: 'hk-uuid',
          startedAt: s1,
          completedAt: c1,
          assignedTo: { id: 'hk-uuid', firstName: 'Jane', lastName: 'Doe' },
        },
        {
          assignedToId: 'hk-uuid',
          startedAt: s2,
          completedAt: c2,
          assignedTo: { id: 'hk-uuid', firstName: 'Jane', lastName: 'Doe' },
        },
      ]);

      const metrics = await service.getMetrics('prop-uuid');

      expect(metrics.staffPerformance[0]!.completedTasks).toBe(2);
      expect(metrics.staffPerformance[0]!.avgTurnaroundMinutes).toBe(45); // (60+30)/2
    });

    it('skips tasks with no assignedToId in staff aggregation', async () => {
      mockPrisma.housekeepingTask.count.mockResolvedValue(0);
      mockPrisma.housekeepingTask.findMany.mockResolvedValue([
        {
          assignedToId: null,
          startedAt: new Date(),
          completedAt: new Date(),
          assignedTo: null,
        },
      ]);

      const metrics = await service.getMetrics('prop-uuid');

      expect(metrics.staffPerformance).toHaveLength(0);
    });
  });
});
