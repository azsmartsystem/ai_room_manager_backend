import { TicketStatus } from '@prisma/client';
import { TicketStatusStateMachine } from './ticket-status.state-machine';
import { InvalidTicketStateTransitionException } from '../common/exceptions/operations/invalid-ticket-state-transition.exception';

describe('TicketStatusStateMachine', () => {
  // ─── canTransition ────────────────────────────────────────────────────────

  describe('canTransition', () => {
    it.each([
      [TicketStatus.OPEN, TicketStatus.ASSIGNED],
      [TicketStatus.OPEN, TicketStatus.CLOSED],
      [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
      [TicketStatus.ASSIGNED, TicketStatus.OPEN],
      [TicketStatus.ASSIGNED, TicketStatus.CLOSED],
      [TicketStatus.IN_PROGRESS, TicketStatus.PENDING_PARTS],
      [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
      [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      [TicketStatus.PENDING_PARTS, TicketStatus.IN_PROGRESS],
      [TicketStatus.PENDING_PARTS, TicketStatus.CLOSED],
      [TicketStatus.RESOLVED, TicketStatus.CLOSED],
    ] as [TicketStatus, TicketStatus][])(
      'returns true for valid transition %s → %s',
      (from, to) => {
        expect(TicketStatusStateMachine.canTransition(from, to)).toBe(true);
      },
    );

    it.each([
      [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
      [TicketStatus.OPEN, TicketStatus.PENDING_PARTS],
      [TicketStatus.OPEN, TicketStatus.RESOLVED],
      [TicketStatus.ASSIGNED, TicketStatus.PENDING_PARTS],
      [TicketStatus.ASSIGNED, TicketStatus.RESOLVED],
      [TicketStatus.IN_PROGRESS, TicketStatus.OPEN],
      [TicketStatus.IN_PROGRESS, TicketStatus.ASSIGNED],
      [TicketStatus.PENDING_PARTS, TicketStatus.OPEN],
      [TicketStatus.PENDING_PARTS, TicketStatus.ASSIGNED],
      [TicketStatus.PENDING_PARTS, TicketStatus.RESOLVED],
      [TicketStatus.RESOLVED, TicketStatus.OPEN],
      [TicketStatus.RESOLVED, TicketStatus.ASSIGNED],
      [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS],
      [TicketStatus.RESOLVED, TicketStatus.PENDING_PARTS],
      [TicketStatus.CLOSED, TicketStatus.OPEN],
      [TicketStatus.CLOSED, TicketStatus.ASSIGNED],
      [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
      [TicketStatus.CLOSED, TicketStatus.PENDING_PARTS],
      [TicketStatus.CLOSED, TicketStatus.RESOLVED],
    ] as [TicketStatus, TicketStatus][])(
      'returns false for invalid transition %s → %s',
      (from, to) => {
        expect(TicketStatusStateMachine.canTransition(from, to)).toBe(false);
      },
    );

    it('returns false for self-transitions', () => {
      for (const status of Object.values(TicketStatus)) {
        expect(TicketStatusStateMachine.canTransition(status, status)).toBe(false);
      }
    });
  });

  // ─── validateTransition ───────────────────────────────────────────────────

  describe('validateTransition', () => {
    it('does not throw for a valid transition', () => {
      expect(() =>
        TicketStatusStateMachine.validateTransition(TicketStatus.OPEN, TicketStatus.ASSIGNED),
      ).not.toThrow();
    });

    it('throws InvalidTicketStateTransitionException for an invalid transition', () => {
      expect(() =>
        TicketStatusStateMachine.validateTransition(TicketStatus.CLOSED, TicketStatus.OPEN),
      ).toThrow(InvalidTicketStateTransitionException);
    });

    it('includes the reason in the exception when provided', () => {
      try {
        TicketStatusStateMachine.validateTransition(
          TicketStatus.RESOLVED,
          TicketStatus.IN_PROGRESS,
          'test reason',
        );
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(InvalidTicketStateTransitionException);
        const ex = err as InvalidTicketStateTransitionException;
        expect(ex.context['reason']).toBe('test reason');
      }
    });

    it('throws for PENDING_PARTS → RESOLVED (must go through IN_PROGRESS first)', () => {
      expect(() =>
        TicketStatusStateMachine.validateTransition(
          TicketStatus.PENDING_PARTS,
          TicketStatus.RESOLVED,
        ),
      ).toThrow(InvalidTicketStateTransitionException);
    });

    it('throws for CLOSED → anything (terminal state)', () => {
      expect(() =>
        TicketStatusStateMachine.validateTransition(TicketStatus.CLOSED, TicketStatus.RESOLVED),
      ).toThrow(InvalidTicketStateTransitionException);
    });
  });
});
