import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class InvalidCredentialsException extends RoomManagerException {
  constructor(detail = 'Invalid email or password provided') {
    super(
      {
        code: 'AUTH_INVALID_CREDENTIALS',
        detail,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
