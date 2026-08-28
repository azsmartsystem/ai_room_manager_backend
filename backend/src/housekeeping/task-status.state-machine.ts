import { TaskStatus } from '@prisma/client';
import { InvalidTaskStateTransitionException } from '../common/exceptions/operations/invalid-task-state-transition.exception';

/**
 * Valid transitions for the HousekeepingTask state machine:
 *
 *  PENDING     → ASSIGNED   (supervisor assigns a housekeeper)
 *  PENDING     → CANCELLED  (task cancelled before assignment)
 *
 *  ASSIGNED    → IN_PROGRESS (housekeeper starts cleaning)
 *  ASSIGNED    → PENDING     (housekeeper unassigned / reassignment)
 *  ASSIGNED    → CANCELLED   (task cancelled after assignment)
 *
 *  IN_PROGRESS → INSPECTION  (housekeeper marks job done; awaiting supervisor)
 *  IN_PROGRESS → CANCELLED   (task cancelled while in progress)
 *
 *  INSPECTION  → COMPLETED   (supervisor inspection passed; triggers room → VACANT_CLEAN)
 *  INSPECTION  → IN_PROGRESS (supervisor fails inspection; re-clean required)
 *
 *  COMPLETED   → (terminal)
 *  CANCELLED   → (terminal)
 */
const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
  [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.PENDING, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.INSPECTION, TaskStatus.CANCELLED],
  [TaskStatus.INSPECTION]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.CANCELLED]: [],
};

export class TaskStatusStateMachine {
  /**
   * Returns `true` if the transition from `from` → `to` is permitted.
   * A no-op self-transition always returns `false` to prevent redundant DB writes.
   */
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    if (from === to) return false;
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates a transition and throws `InvalidTaskStateTransitionException` if illegal.
   */
  static validateTransition(from: TaskStatus, to: TaskStatus, reason?: string): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidTaskStateTransitionException(from, to, reason);
    }
  }
}
