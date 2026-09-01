import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { TopicRegistry } from '../topics/topic.registry';

@Injectable()
export class SensorEventSubscriber implements OnModuleInit {
  private readonly logger = new Logger(SensorEventSubscriber.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly ingestionService: IngestionService,
  ) {}

  onModuleInit(): void {
    this.mqttService.registerHandler(async (topic: string, payload: unknown) => {
      if (TopicRegistry.parseSensorTopic(topic)) {
        await this.ingestionService.ingestSensorTelemetry(topic, payload);
      } else if (TopicRegistry.parseEmergencyTopic(topic)) {
        await this.ingestionService.ingestEmergencyAlert(topic, payload);
      }
    });
  }
}
