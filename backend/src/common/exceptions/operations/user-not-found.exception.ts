import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class UserNotFoundException extends RoomManagerException {
  constructor(identifier: string) {
    super(
      {
        code: 'USER_NOT_FOUND',
        detail: `User with identifier '${identifier}' was not found`,
        context: { identifier },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
