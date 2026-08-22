import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class BuildingNotFoundException extends RoomManagerException {
  constructor(buildingId: string) {
    super(
      {
        code: 'BUILDING_NOT_FOUND',
        detail: `Building with identifier '${buildingId}' was not found.`,
        context: { buildingId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
