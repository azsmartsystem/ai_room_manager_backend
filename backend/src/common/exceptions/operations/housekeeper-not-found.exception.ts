import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class HousekeeperNotFoundException extends RoomManagerException {
  constructor(userId: string) {
    super(
      {
        code: 'HOUSEKEEPER_NOT_FOUND',
        detail: `User '${userId}' was not found or does not have the HOUSEKEEPING role.`,
        context: { userId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
