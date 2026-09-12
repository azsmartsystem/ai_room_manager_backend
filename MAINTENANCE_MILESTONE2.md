# Maintenance Module — Milestone 2 Summary

## Overview

Implemented a full maintenance ticket management system for the backend. The module handles the complete ticket lifecycle from creation to closure, with enforced state transitions, audit logging, and role-based access control.

---

## What Was Built

### Ticket Lifecycle (State Machine)

```
OPEN → ASSIGNED → IN_PROGRESS → PENDING_PARTS → RESOLVED → CLOSED
                      ↑              │
                      └──────────────┘
```

- **6 statuses:** OPEN, ASSIGNED, IN_PROGRESS, PENDING_PARTS, RESOLVED, CLOSED
- **4 priority levels:** LOW, MEDIUM, HIGH, CRITICAL
- All transitions are validated by a pure state machine — illegal transitions throw typed exceptions

### API Endpoints (9 total)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/properties/:propertyId/maintenance` | Create a ticket |
| GET | `/properties/:propertyId/maintenance` | List tickets (filterable) |
| GET | `/properties/:propertyId/maintenance/tickets/:ticketId` | Get single ticket |
| PATCH | `.../tickets/:ticketId/assign` | Assign to technician |
| PATCH | `.../tickets/:ticketId/start` | Start work |
| PATCH | `.../tickets/:ticketId/pending-parts` | Mark pending parts |
| PATCH | `.../tickets/:ticketId/resolve` | Mark resolved |
| PATCH | `.../tickets/:ticketId/close` | Close ticket |
| GET | `/properties/:propertyId/maintenance/rooms/:roomId/tickets` | Tickets by room |

### Key Features

- **Role-based access** — Each endpoint is guarded by role restrictions (e.g., only SUPER_ADMIN/PROPERTY_MANAGER can assign/close tickets)
- **Audit logging** — Every mutation writes an audit record with actor identity, action, and metadata
- **Room status integration** — Closing a RESOLVED ticket automatically transitions the room from `MAINTENANCE_REQUIRED` to `VACANT_DIRTY` (triggers housekeeping)
- **Re-assignment handling** — Re-assigning a ticket pivots through OPEN internally (ASSIGNED → OPEN → ASSIGNED) to keep the state machine clean
- **TypeBox validation** — All request bodies and query params validated via schemas at the controller level

---

## Architecture

```
Controller (HTTP only)
    │
    ▼
Service (business logic)
    ├── PrismaService (database)
    ├── AuditService (audit trail)
    └── TicketStatusStateMachine (transition validation)
```

- **Strict separation of concerns** — Controller has zero business logic
- **State machine is pure** — No I/O, just transition rules
- **Service is transport-agnostic** — Could be called from HTTP, MQTT, CLI, etc.

---

## Files

| File | Purpose |
|------|---------|
| `maintainance.module.ts` | NestJS module wiring |
| `maintainance.controller.ts` | HTTP routing + guards |
| `maintainance.service.ts` | Business logic |
| `ticket-status.state-machine.ts` | Transition validation |
| `dto/maintenance.dto.ts` | TypeBox schemas + types |
| `entities/ticket.entity.ts` | Entity placeholder |
| `maintainance.controller.spec.ts` | Controller unit tests |
| `maintainance.service.spec.ts` | Service unit tests |
| `ticket-status.state-machine.spec.ts` | State machine unit tests |

---

## Test Coverage

- Controller tests: verify each endpoint delegates to the correct service method
- Service tests: cover happy paths, error paths, state transitions, audit logging, room status side effects
- State machine tests: parameterized tests for every valid/invalid transition

---

## Decisions & Trade-offs

1. **Prisma `MaintenanceTicket` model** drives the entity shape — no custom entity class
2. **TICKET_INCLUDE** constant defines a consistent query shape (room + assignedTo) used across all queries
3. **Default priority** is MEDIUM when creating a ticket
4. **Terminal state** — CLOSED has no outgoing transitions; once closed, a ticket cannot be reopened
