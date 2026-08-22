import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class DeviceNotFoundException extends RoomManagerException {
  constructor(deviceId: string) {
    super(
      {
        code: 'DEVICE_NOT_FOUND',
        detail: `IoT device with identifier '${deviceId}' was not found.`,
        context: { deviceId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
