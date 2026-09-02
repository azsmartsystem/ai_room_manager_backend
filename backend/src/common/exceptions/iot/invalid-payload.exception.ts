import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class InvalidPayloadException extends RoomManagerException {
  constructor(topic: string, rawPayload: unknown, validationErrors?: unknown) {
    super(
      {
        code: 'IOT_INVALID_PAYLOAD',
        detail: `MQTT payload on topic '${topic}' failed schema validation.`,
        context: { topic, rawPayload, validationErrors },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
