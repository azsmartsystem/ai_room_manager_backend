import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';
import { TicketStatus } from '@prisma/client';

export class InvalidTicketStateTransitionException extends RoomManagerException {
  constructor(currentStatus: TicketStatus, attemptedStatus: TicketStatus, reason?: string) {
    super(
      {
        code: 'INVALID_TICKET_STATE_TRANSITION',
        detail:
          `Cannot transition maintenance ticket from '${currentStatus}' to '${attemptedStatus}'. ${reason ?? ''}`.trim(),
        context: { currentStatus, attemptedStatus, reason },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
