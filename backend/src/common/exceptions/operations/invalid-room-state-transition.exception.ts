import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';
import { RoomStatus } from '@prisma/client';

export class InvalidRoomStateTransitionException extends RoomManagerException {
  constructor(currentStatus: RoomStatus, attemptedStatus: RoomStatus, reason?: string) {
    super(
      {
        code: 'INVALID_ROOM_STATE_TRANSITION',
        detail:
          `Cannot transition room from '${currentStatus}' to '${attemptedStatus}'. ${reason ?? ''}`.trim(),
        context: { currentStatus, attemptedStatus, reason },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
