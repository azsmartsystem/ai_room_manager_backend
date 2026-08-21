import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class UserAlreadyExistsException extends RoomManagerException {
  constructor(email: string) {
    super(
      {
        code: 'USER_ALREADY_EXISTS',
        detail: `A user with email '${email}' already exists`,
        context: { email },
      },
      HttpStatus.CONFLICT,
    );
  }
}
