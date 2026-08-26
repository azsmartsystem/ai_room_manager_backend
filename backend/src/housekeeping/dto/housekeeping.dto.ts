import { Type, Static } from '@sinclair/typebox';

// ─── Create Task ──────────────────────────────────────────────────────────────

export const CreateTaskDtoSchema = Type.Object({
  roomId: Type.String({ minLength: 1, description: 'UUID of the room to create the task for' }),
  priority: Type.Optional(
    Type.Union(
      [Type.Literal('LOW'), Type.Literal('MEDIUM'), Type.Literal('HIGH'), Type.Literal('CRITICAL')],
      { description: 'Task priority. Defaults to MEDIUM if not provided.' },
    ),
  ),
  notes: Type.Optional(Type.String({ description: 'Optional notes or instructions for the task' })),
});

export type CreateTaskDto = Static<typeof CreateTaskDtoSchema>;

// ─── Assign Task ──────────────────────────────────────────────────────────────

export const AssignTaskDtoSchema = Type.Object({
  assignedToId: Type.String({
    minLength: 1,
    description: 'UUID of the HOUSEKEEPING user to assign this task to',
  }),
});

export type AssignTaskDto = Static<typeof AssignTaskDtoSchema>;

// ─── Complete Task ────────────────────────────────────────────────────────────

export const CompleteTaskDtoSchema = Type.Object({
  notes: Type.Optional(
    Type.String({ description: 'Notes from the housekeeper upon task completion' }),
  ),
});

export type CompleteTaskDto = Static<typeof CompleteTaskDtoSchema>;

// ─── Inspect Task ─────────────────────────────────────────────────────────────

export const InspectTaskDtoSchema = Type.Object({
  passed: Type.Boolean({
    description: 'true = inspection passed (room → VACANT_CLEAN), false = fail (re-clean required)',
  }),
  notes: Type.Optional(Type.String({ description: 'Supervisor notes from the inspection' })),
});

export type InspectTaskDto = Static<typeof InspectTaskDtoSchema>;

// ─── List Tasks Query ─────────────────────────────────────────────────────────

export const ListTasksQuerySchema = Type.Object({
  status: Type.Optional(
    Type.Union(
      [
        Type.Literal('PENDING'),
        Type.Literal('ASSIGNED'),
        Type.Literal('IN_PROGRESS'),
        Type.Literal('INSPECTION'),
        Type.Literal('COMPLETED'),
        Type.Literal('CANCELLED'),
      ],
      { description: 'Filter tasks by status' },
    ),
  ),
  assignedToId: Type.Optional(
    Type.String({ description: 'Filter tasks by assigned housekeeper UUID' }),
  ),
  roomId: Type.Optional(Type.String({ description: 'Filter tasks by room UUID' })),
});

export type ListTasksQuery = Static<typeof ListTasksQuerySchema>;
