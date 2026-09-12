import { TicketStatus } from '@prisma/client';
import { InvalidTicketStateTransitionException } from '../common/exceptions/operations/invalid-ticket-state-transition.exception';

/**
 * Valid transitions for the MaintenanceTicket state machine:
 *
 *  OPEN          → ASSIGNED, CLOSED
 *
 *  ASSIGNED      → IN_PROGRESS, OPEN, CLOSED
 *
 *  IN_PROGRESS   → PENDING_PARTS, RESOLVED, CLOSED
 *
 *  PENDING_PARTS → IN_PROGRESS, CLOSED
 *
 *  RESOLVED      → CLOSED
 *
 *  CLOSED        → (terminal)
 */
const VALID_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.ASSIGNED, TicketStatus.CLOSED],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.OPEN, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.PENDING_PARTS,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.PENDING_PARTS]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

export class TicketStatusStateMachine {
  /**
   * Returns `true` if the transition from `from` → `to` is permitted.
   * A no-op self-transition always returns `false` to prevent redundant DB writes.
   */
  static canTransition(from: TicketStatus, to: TicketStatus): boolean {
    if (from === to) return false;
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates a transition and throws `InvalidTicketStateTransitionException` if illegal.
   */
  static validateTransition(from: TicketStatus, to: TicketStatus, reason?: string): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidTicketStateTransitionException(from, to, reason);
    }
  }
}
