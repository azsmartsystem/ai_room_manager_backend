import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class RoomNotFoundException extends RoomManagerException {
  constructor(roomId: string) {
    super(
      {
        code: 'ROOM_NOT_FOUND',
        detail: `Room with identifier '${roomId}' was not found.`,
        context: { roomId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
