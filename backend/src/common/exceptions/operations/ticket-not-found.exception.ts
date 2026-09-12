import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class TicketNotFoundException extends RoomManagerException {
  constructor(ticketId: string) {
    super(
      {
        code: 'TICKET_NOT_FOUND',
        detail: `Maintenance ticket with identifier '${ticketId}' was not found.`,
        context: { ticketId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
