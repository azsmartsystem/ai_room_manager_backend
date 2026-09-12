import { OccupancyListener } from './occupancy.listener';
import type { SensorEvent } from '../iot/events/sensor-event';

describe('OccupancyListener', () => {
  it('delegates sensor events to OccupancyService.handleSensorEvent', async () => {
    const handleSensorEvent = jest.fn().mockResolvedValueOnce(undefined);
    const mockService = {
      handleSensorEvent,
    } as unknown as import('./occupancy.service').OccupancyService;

    const listener = new OccupancyListener(mockService);

    const event: SensorEvent = {
      propertyId: 'prop-1',
      roomId: 'room-1',
      sensorType: 'pir',
      deviceId: 'dev-1',
      gatewayId: 'gw-1',
      value: { motionDetected: true } as unknown as SensorEvent['value'],
      occurredAt: new Date(),
      rawPayload: {},
    };

    await listener.onSensorEvent(event);

    expect(handleSensorEvent).toHaveBeenCalledTimes(1);
    expect(handleSensorEvent).toHaveBeenCalledWith(event);
  });

  it('propagates the promise returned by the service', async () => {
    const handleSensorEvent = jest.fn().mockResolvedValueOnce(undefined);
    const mockService = {
      handleSensorEvent,
    } as unknown as import('./occupancy.service').OccupancyService;
    const listener = new OccupancyListener(mockService);

    const event: SensorEvent = {
      propertyId: 'prop-1',
      roomId: 'room-2',
      sensorType: 'door',
      deviceId: 'dev-door-1',
      gatewayId: 'gw-1',
      value: { state: 'OPEN' } as unknown as SensorEvent['value'],
      occurredAt: new Date(),
      rawPayload: {},
    };

    await expect(listener.onSensorEvent(event)).resolves.toBeUndefined();
  });
});
