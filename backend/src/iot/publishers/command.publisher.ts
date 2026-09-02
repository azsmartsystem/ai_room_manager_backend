import { Injectable, Logger } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { TopicRegistry } from '../topics/topic.registry';
import { CommandPayload } from '../topics/topic-schema';

@Injectable()
export class CommandPublisher {
  private readonly logger = new Logger(CommandPublisher.name);

  constructor(private readonly mqttService: MqttService) {}

  async publishCommand(
    propertyId: string,
    roomId: string,
    action: string,
    targetDeviceId: string,
    parameters: Record<string, unknown>,
    expiresAt?: Date,
  ): Promise<string> {
    const topic = TopicRegistry.buildCommandTopic(propertyId, roomId, action);
    const commandId = `cmd_${Math.random().toString(16).substring(2, 12)}_${Date.now()}`;

    const payload: CommandPayload = {
      commandId,
      action,
      targetDeviceId,
      parameters,
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
    };

    this.logger.log({
      event: 'DISPATCHING_DEVICE_COMMAND',
      propertyId,
      roomId,
      action,
      targetDeviceId,
      commandId,
    });

    await this.mqttService.publish(topic, payload, 1);
    return commandId;
  }
}
