import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class InvalidTokenException extends RoomManagerException {
  constructor(detail = 'The provided authentication token is invalid or has expired') {
    super(
      {
        code: 'AUTH_INVALID_TOKEN',
        detail,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
