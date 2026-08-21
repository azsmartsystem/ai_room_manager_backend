import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class InsufficientRoleException extends RoomManagerException {
  constructor(requiredRoles: string[], userRole?: string) {
    super(
      {
        code: 'AUTH_INSUFFICIENT_ROLE',
        detail: `User role '${userRole ?? 'UNKNOWN'}' does not have required permissions: [${requiredRoles.join(', ')}]`,
        context: { requiredRoles, userRole },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
