import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OccupancyService } from './occupancy.service';
import type { SensorEvent } from '../iot/events/sensor-event';

@Injectable()
export class OccupancyListener {
  constructor(private readonly occupancyService: OccupancyService) {}

  @OnEvent('sensor.event')
  async onSensorEvent(event: SensorEvent): Promise<void> {
    await this.occupancyService.handleSensorEvent(event);
  }
}
