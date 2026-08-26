import { TaskStatusStateMachine } from './task-status.state-machine';
import { TaskStatus } from '@prisma/client';
import { InvalidTaskStateTransitionException } from '../common/exceptions/operations/invalid-task-state-transition.exception';

describe('TaskStatusStateMachine', () => {
  // ─── canTransition ───────────────────────────────────────────────────────────

  describe('canTransition', () => {
    it('returns false for self-transitions', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.PENDING, TaskStatus.PENDING)).toBe(
        false,
      );
    });

    // PENDING transitions
    it('PENDING → ASSIGNED is valid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.PENDING, TaskStatus.ASSIGNED)).toBe(
        true,
      );
    });

    it('PENDING → CANCELLED is valid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.PENDING, TaskStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('PENDING → IN_PROGRESS is invalid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.PENDING, TaskStatus.IN_PROGRESS)).toBe(
        false,
      );
    });

    it('PENDING → COMPLETED is invalid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.PENDING, TaskStatus.COMPLETED)).toBe(
        false,
      );
    });

    // ASSIGNED transitions
    it('ASSIGNED → IN_PROGRESS is valid', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS),
      ).toBe(true);
    });

    it('ASSIGNED → PENDING is valid (unassign)', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.ASSIGNED, TaskStatus.PENDING)).toBe(
        true,
      );
    });

    it('ASSIGNED → CANCELLED is valid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.ASSIGNED, TaskStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('ASSIGNED → COMPLETED is invalid', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.ASSIGNED, TaskStatus.COMPLETED)).toBe(
        false,
      );
    });

    // IN_PROGRESS transitions
    it('IN_PROGRESS → INSPECTION is valid', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.INSPECTION),
      ).toBe(true);
    });

    it('IN_PROGRESS → CANCELLED is valid', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED),
      ).toBe(true);
    });

    it('IN_PROGRESS → COMPLETED is invalid (must go through INSPECTION)', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED),
      ).toBe(false);
    });

    // INSPECTION transitions
    it('INSPECTION → COMPLETED is valid (pass)', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.INSPECTION, TaskStatus.COMPLETED),
      ).toBe(true);
    });

    it('INSPECTION → IN_PROGRESS is valid (fail/re-clean)', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.INSPECTION, TaskStatus.IN_PROGRESS),
      ).toBe(true);
    });

    it('INSPECTION → CANCELLED is invalid', () => {
      expect(
        TaskStatusStateMachine.canTransition(TaskStatus.INSPECTION, TaskStatus.CANCELLED),
      ).toBe(false);
    });

    // Terminal states
    it('COMPLETED → PENDING is invalid (terminal)', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.COMPLETED, TaskStatus.PENDING)).toBe(
        false,
      );
    });

    it('CANCELLED → PENDING is invalid (terminal)', () => {
      expect(TaskStatusStateMachine.canTransition(TaskStatus.CANCELLED, TaskStatus.PENDING)).toBe(
        false,
      );
    });

    it('returns false for an unknown from status (safety guard)', () => {
      // Cast unknown value to bypass TypeScript — mirrors runtime safety behaviour
      expect(
        TaskStatusStateMachine.canTransition('UNKNOWN_STATUS' as TaskStatus, TaskStatus.PENDING),
      ).toBe(false);
    });
  });

  // ─── validateTransition ──────────────────────────────────────────────────────

  describe('validateTransition', () => {
    it('does not throw for a valid transition', () => {
      expect(() =>
        TaskStatusStateMachine.validateTransition(TaskStatus.PENDING, TaskStatus.ASSIGNED),
      ).not.toThrow();
    });

    it('throws InvalidTaskStateTransitionException for an invalid transition', () => {
      expect(() =>
        TaskStatusStateMachine.validateTransition(TaskStatus.COMPLETED, TaskStatus.PENDING),
      ).toThrow(InvalidTaskStateTransitionException);
    });

    it('throws InvalidTaskStateTransitionException for a self-transition', () => {
      expect(() =>
        TaskStatusStateMachine.validateTransition(TaskStatus.PENDING, TaskStatus.PENDING),
      ).toThrow(InvalidTaskStateTransitionException);
    });

    it('exception message contains both statuses', () => {
      let error: unknown;
      try {
        TaskStatusStateMachine.validateTransition(TaskStatus.CANCELLED, TaskStatus.ASSIGNED);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(InvalidTaskStateTransitionException);
      const msg = (error as InvalidTaskStateTransitionException).message;
      expect(msg).toContain('CANCELLED');
      expect(msg).toContain('ASSIGNED');
    });
  });
});
