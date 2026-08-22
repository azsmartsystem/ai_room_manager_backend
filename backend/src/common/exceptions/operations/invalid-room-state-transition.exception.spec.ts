import { InvalidRoomStateTransitionException } from './invalid-room-state-transition.exception';
import { RoomStatus } from '@prisma/client';

describe('InvalidRoomStateTransitionException', () => {
  it('should format message without reason when omitted', () => {
    const ex = new InvalidRoomStateTransitionException(
      RoomStatus.VACANT_DIRTY,
      RoomStatus.OCCUPIED_CLEAN,
    );
    expect(ex.message).toBe("Cannot transition room from 'VACANT_DIRTY' to 'OCCUPIED_CLEAN'.");
    expect(ex.context['reason']).toBeUndefined();
  });

  it('should format message with reason when provided', () => {
    const ex = new InvalidRoomStateTransitionException(
      RoomStatus.VACANT_DIRTY,
      RoomStatus.OCCUPIED_CLEAN,
      'Room is not clean yet',
    );
    expect(ex.message).toBe(
      "Cannot transition room from 'VACANT_DIRTY' to 'OCCUPIED_CLEAN'. Room is not clean yet",
    );
    expect(ex.context['reason']).toBe('Room is not clean yet');
  });
});
