import { Module } from '@nestjs/common';
import { MqttModule } from './mqtt/mqtt.module';
import { DevicesModule } from './devices/devices.module';
import { IngestionService } from './ingestion/ingestion.service';
import { SensorEventSubscriber } from './subscribers/sensor-event.subscriber';
import { HeartbeatSubscriber } from './subscribers/heartbeat.subscriber';
import { AcknowledgmentSubscriber } from './subscribers/acknowledgment.subscriber';
import { DeviceErrorSubscriber } from './subscribers/device-error.subscriber';
import { CommandPublisher } from './publishers/command.publisher';

@Module({
  imports: [MqttModule, DevicesModule],
  providers: [
    IngestionService,
    SensorEventSubscriber,
    HeartbeatSubscriber,
    AcknowledgmentSubscriber,
    DeviceErrorSubscriber,
    CommandPublisher,
  ],
  exports: [MqttModule, DevicesModule, IngestionService, CommandPublisher],
})
export class IotModule {}
