import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class PropertyNotFoundException extends RoomManagerException {
  constructor(propertyId: string) {
    super(
      {
        code: 'PROPERTY_NOT_FOUND',
        detail: `Property with identifier '${propertyId}' was not found.`,
        context: { propertyId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
