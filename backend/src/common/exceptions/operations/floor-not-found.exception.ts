import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class FloorNotFoundException extends RoomManagerException {
  constructor(floorId: string) {
    super(
      {
        code: 'FLOOR_NOT_FOUND',
        detail: `Floor with identifier '${floorId}' was not found.`,
        context: { floorId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
