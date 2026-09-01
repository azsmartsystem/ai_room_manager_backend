import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class StaleHeartbeatException extends RoomManagerException {
  constructor(gatewayId: string, lastHeartbeatAt?: Date | null, timeDifferenceSeconds?: number) {
    super(
      {
        code: 'IOT_STALE_HEARTBEAT',
        detail: `Heartbeat for gateway '${gatewayId}' is stale or expired.`,
        context: { gatewayId, lastHeartbeatAt, timeDifferenceSeconds },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
