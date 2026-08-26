import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';
import { TaskStatus } from '@prisma/client';

export class InvalidTaskStateTransitionException extends RoomManagerException {
  constructor(currentStatus: TaskStatus, attemptedStatus: TaskStatus, reason?: string) {
    super(
      {
        code: 'INVALID_TASK_STATE_TRANSITION',
        detail:
          `Cannot transition housekeeping task from '${currentStatus}' to '${attemptedStatus}'. ${reason ?? ''}`.trim(),
        context: { currentStatus, attemptedStatus, reason },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
