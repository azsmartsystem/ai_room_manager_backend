import { Type, Static } from '@sinclair/typebox';

// ─── Create Ticket ────────────────────────────────────────────────────────────

export const CreateTicketDtoSchema = Type.Object({
  roomId: Type.String({ minLength: 1, description: 'UUID of the room to create the ticket for' }),
  title: Type.String({ minLength: 3, maxLength: 120, description: 'Short title of the issue' }),
  description: Type.String({
    minLength: 10,
    maxLength: 1000,
    description: 'Detailed description of the maintenance issue',
  }),
  category: Type.String({
    minLength: 2,
    maxLength: 60,
    description: 'Issue category (e.g. Plumbing, Electrical)',
  }),
  priority: Type.Optional(
    Type.Union(
      [Type.Literal('LOW'), Type.Literal('MEDIUM'), Type.Literal('HIGH'), Type.Literal('CRITICAL')],
      { description: 'Ticket priority. Defaults to MEDIUM if not provided.' },
    ),
  ),
});

export type CreateTicketDto = Static<typeof CreateTicketDtoSchema>;

// ─── Assign Ticket ────────────────────────────────────────────────────────────

export const AssignTicketDtoSchema = Type.Object({
  technicianId: Type.String({
    minLength: 1,
    description: 'UUID of the MAINTENANCE role user to assign this ticket to',
  }),
});

export type AssignTicketDto = Static<typeof AssignTicketDtoSchema>;

// ─── Update Ticket Status ─────────────────────────────────────────────────────

export const UpdateTicketStatusDtoSchema = Type.Object({
  status: Type.Union(
    [
      Type.Literal('OPEN'),
      Type.Literal('ASSIGNED'),
      Type.Literal('IN_PROGRESS'),
      Type.Literal('PENDING_PARTS'),
      Type.Literal('RESOLVED'),
      Type.Literal('CLOSED'),
    ],
    { description: 'Target ticket status' },
  ),
  notes: Type.Optional(
    Type.String({ maxLength: 500, description: 'Optional notes for the status update' }),
  ),
});

export type UpdateTicketStatusDto = Static<typeof UpdateTicketStatusDtoSchema>;

// ─── List Tickets Query ───────────────────────────────────────────────────────

export const ListTicketsQuerySchema = Type.Object({
  roomId: Type.Optional(Type.String({ description: 'Filter tickets by room UUID' })),
  assignedToId: Type.Optional(
    Type.String({ description: 'Filter tickets by assigned technician UUID' }),
  ),
  status: Type.Optional(
    Type.Union(
      [
        Type.Literal('OPEN'),
        Type.Literal('ASSIGNED'),
        Type.Literal('IN_PROGRESS'),
        Type.Literal('PENDING_PARTS'),
        Type.Literal('RESOLVED'),
        Type.Literal('CLOSED'),
      ],
      { description: 'Filter tickets by status' },
    ),
  ),
  priority: Type.Optional(
    Type.Union(
      [Type.Literal('LOW'), Type.Literal('MEDIUM'), Type.Literal('HIGH'), Type.Literal('CRITICAL')],
      { description: 'Filter tickets by priority' },
    ),
  ),
  propertyId: Type.Optional(Type.String({ description: 'Filter tickets by property UUID' })),
});

export type ListTicketsQuery = Static<typeof ListTicketsQuerySchema>;
