import { RoomStatus } from '@prisma/client';
import { InvalidRoomStateTransitionException } from '../common/exceptions/operations/invalid-room-state-transition.exception';

/**
 * Valid transitions lookup table for RoomStatus:
 *
 * - VACANT_CLEAN:
 *     -> OCCUPIED_CLEAN (Guest Check-in)
 *     -> VACANT_DIRTY (Manual mark dirty / inspection expire)
 *     -> MAINTENANCE_REQUIRED (Issue detected)
 *     -> OUT_OF_ORDER (Renovation / deep repair)
 *
 * - VACANT_DIRTY:
 *     -> VACANT_CLEAN (Housekeeping cleaned & inspected)
 *     -> MAINTENANCE_REQUIRED (Issue detected during cleaning)
 *     -> OUT_OF_ORDER (Uninhabitable)
 *
 * - OCCUPIED_CLEAN:
 *     -> OCCUPIED_DIRTY (Occupied for 24h / daily cleaning cycle)
 *     -> VACANT_DIRTY (Guest Check-out)
 *     -> MAINTENANCE_REQUIRED (In-stay maintenance reported)
 *     -> OUT_OF_ORDER (Emergency vacate)
 *
 * - OCCUPIED_DIRTY:
 *     -> OCCUPIED_CLEAN (In-stay cleaning completed)
 *     -> VACANT_DIRTY (Guest Check-out)
 *     -> MAINTENANCE_REQUIRED (In-stay maintenance reported)
 *     -> OUT_OF_ORDER (Emergency vacate)
 *
 * - MAINTENANCE_REQUIRED:
 *     -> VACANT_DIRTY (Maintenance resolved; needs cleaning)
 *     -> VACANT_CLEAN (Minor maintenance resolved without cleaning needed)
 *     -> OUT_OF_ORDER (Escalated to major repair)
 *     -> OCCUPIED_CLEAN (In-stay maintenance resolved)
 *     -> OCCUPIED_DIRTY (In-stay maintenance resolved; needs cleaning)
 *
 * - OUT_OF_ORDER:
 *     -> VACANT_DIRTY (Back in service; requires cleaning & prep)
 *     -> MAINTENANCE_REQUIRED (Work active)
 */
const VALID_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  [RoomStatus.VACANT_CLEAN]: [
    RoomStatus.OCCUPIED_CLEAN,
    RoomStatus.VACANT_DIRTY,
    RoomStatus.MAINTENANCE_REQUIRED,
    RoomStatus.OUT_OF_ORDER,
  ],
  [RoomStatus.VACANT_DIRTY]: [
    RoomStatus.VACANT_CLEAN,
    RoomStatus.MAINTENANCE_REQUIRED,
    RoomStatus.OUT_OF_ORDER,
  ],
  [RoomStatus.OCCUPIED_CLEAN]: [
    RoomStatus.OCCUPIED_DIRTY,
    RoomStatus.VACANT_DIRTY,
    RoomStatus.MAINTENANCE_REQUIRED,
    RoomStatus.OUT_OF_ORDER,
  ],
  [RoomStatus.OCCUPIED_DIRTY]: [
    RoomStatus.OCCUPIED_CLEAN,
    RoomStatus.VACANT_DIRTY,
    RoomStatus.MAINTENANCE_REQUIRED,
    RoomStatus.OUT_OF_ORDER,
  ],
  [RoomStatus.MAINTENANCE_REQUIRED]: [
    RoomStatus.VACANT_DIRTY,
    RoomStatus.VACANT_CLEAN,
    RoomStatus.OUT_OF_ORDER,
    RoomStatus.OCCUPIED_CLEAN,
    RoomStatus.OCCUPIED_DIRTY,
  ],
  [RoomStatus.OUT_OF_ORDER]: [RoomStatus.VACANT_DIRTY, RoomStatus.MAINTENANCE_REQUIRED],
};

export class RoomStatusStateMachine {
  /**
   * Checks whether transitioning from `from` to `to` is permitted.
   */
  static canTransition(from: RoomStatus, to: RoomStatus): boolean {
    if (from === to) {
      return true; // No-op transition
    }
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates and throws `InvalidRoomStateTransitionException` if the transition is illegal.
   */
  static validateTransition(from: RoomStatus, to: RoomStatus, reason?: string): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidRoomStateTransitionException(from, to, reason);
    }
  }
}
