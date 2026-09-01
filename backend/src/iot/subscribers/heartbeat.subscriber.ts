import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { TopicRegistry } from '../topics/topic.registry';

@Injectable()
export class HeartbeatSubscriber implements OnModuleInit {
  private readonly logger = new Logger(HeartbeatSubscriber.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly ingestionService: IngestionService,
  ) {}

  onModuleInit(): void {
    this.mqttService.registerHandler(async (topic: string, payload: unknown) => {
      if (TopicRegistry.parseHeartbeatTopic(topic)) {
        await this.ingestionService.ingestHeartbeat(topic, payload);
      }
    });
  }
}
