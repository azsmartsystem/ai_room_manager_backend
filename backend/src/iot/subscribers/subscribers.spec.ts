import { SensorEventSubscriber } from './sensor-event.subscriber';
import { HeartbeatSubscriber } from './heartbeat.subscriber';
import { AcknowledgmentSubscriber } from './acknowledgment.subscriber';
import { DeviceErrorSubscriber } from './device-error.subscriber';
import { MqttService } from '../mqtt/mqtt.service';
import { IngestionService } from '../ingestion/ingestion.service';

describe('IoT Subscribers', () => {
  let mockMqttService: { registerHandler: jest.Mock };
  let mockIngestionService: {
    ingestSensorTelemetry: jest.Mock;
    ingestEmergencyAlert: jest.Mock;
    ingestHeartbeat: jest.Mock;
    ingestCommandAck: jest.Mock;
    ingestDeviceError: jest.Mock;
  };

  beforeEach(() => {
    mockMqttService = { registerHandler: jest.fn() };
    mockIngestionService = {
      ingestSensorTelemetry: jest.fn(),
      ingestEmergencyAlert: jest.fn(),
      ingestHeartbeat: jest.fn(),
      ingestCommandAck: jest.fn(),
      ingestDeviceError: jest.fn(),
    };
  });

  it('SensorEventSubscriber handles sensor telemetry and emergency alerts', async () => {
    const subscriber = new SensorEventSubscriber(
      mockMqttService as unknown as MqttService,
      mockIngestionService as unknown as IngestionService,
    );
    subscriber.onModuleInit();

    const handler = mockMqttService.registerHandler.mock.calls[0][0];

    await handler('hotel/p1/room/101/sensor/pir', { val: 1 });
    expect(mockIngestionService.ingestSensorTelemetry).toHaveBeenCalledWith(
      'hotel/p1/room/101/sensor/pir',
      { val: 1 },
    );

    await handler('hotel/p1/room/101/emergency', { alert: 'FIRE' });
    expect(mockIngestionService.ingestEmergencyAlert).toHaveBeenCalledWith(
      'hotel/p1/room/101/emergency',
      { alert: 'FIRE' },
    );
  });

  it('HeartbeatSubscriber handles gateway heartbeat topics', async () => {
    const subscriber = new HeartbeatSubscriber(
      mockMqttService as unknown as MqttService,
      mockIngestionService as unknown as IngestionService,
    );
    subscriber.onModuleInit();

    const handler = mockMqttService.registerHandler.mock.calls[0][0];
    await handler('hotel/p1/gateway/gw1/heartbeat', { uptime: 10 });
    expect(mockIngestionService.ingestHeartbeat).toHaveBeenCalledWith(
      'hotel/p1/gateway/gw1/heartbeat',
      { uptime: 10 },
    );
  });

  it('AcknowledgmentSubscriber handles command ack topics', async () => {
    const subscriber = new AcknowledgmentSubscriber(
      mockMqttService as unknown as MqttService,
      mockIngestionService as unknown as IngestionService,
    );
    subscriber.onModuleInit();

    const handler = mockMqttService.registerHandler.mock.calls[0][0];
    await handler('hotel/p1/room/101/ack/set_relay', { status: 'SUCCESS' });
    expect(mockIngestionService.ingestCommandAck).toHaveBeenCalledWith(
      'hotel/p1/room/101/ack/set_relay',
      { status: 'SUCCESS' },
    );
  });

  it('DeviceErrorSubscriber handles gateway error topics', async () => {
    const subscriber = new DeviceErrorSubscriber(
      mockMqttService as unknown as MqttService,
      mockIngestionService as unknown as IngestionService,
    );
    subscriber.onModuleInit();

    const handler = mockMqttService.registerHandler.mock.calls[0][0];
    await handler('hotel/p1/gateway/gw1/errors', { code: 'ERR_1' });
    expect(mockIngestionService.ingestDeviceError).toHaveBeenCalledWith(
      'hotel/p1/gateway/gw1/errors',
      { code: 'ERR_1' },
    );
  });
});
