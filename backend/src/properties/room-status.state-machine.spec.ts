import { RoomStatus } from '@prisma/client';
import { RoomStatusStateMachine } from './room-status.state-machine';
import { InvalidRoomStateTransitionException } from '../common/exceptions/operations/invalid-room-state-transition.exception';

describe('RoomStatusStateMachine', () => {
  describe('canTransition', () => {
    it('should allow same-status no-op transitions', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_CLEAN, RoomStatus.VACANT_CLEAN),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OCCUPIED_DIRTY, RoomStatus.OCCUPIED_DIRTY),
      ).toBe(true);
    });

    it('should allow valid transitions from VACANT_CLEAN', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_CLEAN, RoomStatus.OCCUPIED_CLEAN),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_CLEAN, RoomStatus.VACANT_DIRTY),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(
          RoomStatus.VACANT_CLEAN,
          RoomStatus.MAINTENANCE_REQUIRED,
        ),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_CLEAN, RoomStatus.OUT_OF_ORDER),
      ).toBe(true);
    });

    it('should disallow invalid transitions from VACANT_CLEAN', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_CLEAN, RoomStatus.OCCUPIED_DIRTY),
      ).toBe(false);
    });

    it('should allow valid transitions from VACANT_DIRTY', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_DIRTY, RoomStatus.VACANT_CLEAN),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(
          RoomStatus.VACANT_DIRTY,
          RoomStatus.MAINTENANCE_REQUIRED,
        ),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_DIRTY, RoomStatus.OUT_OF_ORDER),
      ).toBe(true);
    });

    it('should disallow direct check-in to VACANT_DIRTY', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_DIRTY, RoomStatus.OCCUPIED_CLEAN),
      ).toBe(false);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.VACANT_DIRTY, RoomStatus.OCCUPIED_DIRTY),
      ).toBe(false);
    });

    it('should allow valid transitions from OCCUPIED_CLEAN and OCCUPIED_DIRTY', () => {
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OCCUPIED_CLEAN, RoomStatus.VACANT_DIRTY),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OCCUPIED_CLEAN, RoomStatus.OCCUPIED_DIRTY),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OCCUPIED_DIRTY, RoomStatus.OCCUPIED_CLEAN),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OCCUPIED_DIRTY, RoomStatus.VACANT_DIRTY),
      ).toBe(true);
    });

    it('should allow transitions from MAINTENANCE_REQUIRED and OUT_OF_ORDER', () => {
      expect(
        RoomStatusStateMachine.canTransition(
          RoomStatus.MAINTENANCE_REQUIRED,
          RoomStatus.VACANT_CLEAN,
        ),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(
          RoomStatus.MAINTENANCE_REQUIRED,
          RoomStatus.VACANT_DIRTY,
        ),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OUT_OF_ORDER, RoomStatus.VACANT_DIRTY),
      ).toBe(true);
      expect(
        RoomStatusStateMachine.canTransition(RoomStatus.OUT_OF_ORDER, RoomStatus.OCCUPIED_CLEAN),
      ).toBe(false);
    });

    it('should return false when from state is unknown or invalid', () => {
      expect(
        RoomStatusStateMachine.canTransition(
          'UNKNOWN' as unknown as RoomStatus,
          RoomStatus.VACANT_CLEAN,
        ),
      ).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw on valid transition', () => {
      expect(() =>
        RoomStatusStateMachine.validateTransition(
          RoomStatus.VACANT_CLEAN,
          RoomStatus.OCCUPIED_CLEAN,
        ),
      ).not.toThrow();
    });

    it('should throw InvalidRoomStateTransitionException on invalid transition', () => {
      expect(() =>
        RoomStatusStateMachine.validateTransition(
          RoomStatus.VACANT_DIRTY,
          RoomStatus.OCCUPIED_CLEAN,
          'Guest cannot check into a dirty room',
        ),
      ).toThrow(InvalidRoomStateTransitionException);
    });
  });
});
