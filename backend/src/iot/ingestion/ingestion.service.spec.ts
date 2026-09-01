import { IngestionService } from './ingestion.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvalidPayloadException } from '../../common/exceptions/iot/invalid-payload.exception';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockEventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    mockEventEmitter = { emit: jest.fn() };
    service = new IngestionService(mockEventEmitter as unknown as EventEmitter2);
  });

  describe('ingestSensorTelemetry', () => {
    it('successfully ingests valid PIR motion sensor payload', async () => {
      const topic = 'hotel/prop_1/room/101/sensor/pir';
      const payload = {
        version: '1.0',
        deviceId: 'pir_01',
        gatewayId: 'gw_01',
        sensorType: 'pir',
        value: {
          motionDetected: true,
          confidenceScore: 0.95,
          durationMs: 3000,
        },
        occurredAt: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestSensorTelemetry(topic, payload);

      expect(event.propertyId).toBe('prop_1');
      expect(event.roomId).toBe('101');
      expect(event.sensorType).toBe('pir');
      expect(event.deviceId).toBe('pir_01');
      expect(event.value).toEqual(payload.value);
      expect(event.occurredAt).toEqual(new Date('2026-08-21T16:00:00.000Z'));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('sensor.event', event);
    });

    it('successfully ingests valid Door contact sensor payload', async () => {
      const topic = 'hotel/prop_1/room/101/sensor/door';
      const payload = {
        deviceId: 'door_01',
        gatewayId: 'gw_01',
        sensorType: 'door',
        value: {
          state: 'OPEN',
          durationInPreviousStateSec: 120,
        },
        occurredAt: '2026-08-21T16:05:00.000Z',
      };

      const event = await service.ingestSensorTelemetry(topic, payload);
      expect(event.sensorType).toBe('door');
      expect(event.value).toEqual({ state: 'OPEN', durationInPreviousStateSec: 120 });
    });

    it('successfully ingests valid Temperature sensor payload', async () => {
      const topic = 'hotel/prop_1/room/101/sensor/temperature';
      const payload = {
        deviceId: 'temp_01',
        gatewayId: 'gw_01',
        sensorType: 'temperature',
        value: {
          temperatureCelsius: 23.4,
          humidityPercent: 45.0,
          batteryLevelPercent: 90,
        },
        occurredAt: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestSensorTelemetry(topic, payload);
      expect(event.sensorType).toBe('temperature');
      expect(event.value).toEqual(payload.value);
    });

    it('successfully ingests valid Relay state payload', async () => {
      const topic = 'hotel/prop_1/room/101/sensor/relay';
      const payload = {
        deviceId: 'relay_01',
        gatewayId: 'gw_01',
        sensorType: 'relay',
        value: {
          channel: 1,
          relayState: 'ON',
          currentAmps: 2.1,
          voltageVolts: 220.0,
        },
        occurredAt: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestSensorTelemetry(topic, payload);
      expect(event.sensorType).toBe('relay');
      expect(event.value).toEqual(payload.value);
    });

    it('throws InvalidPayloadException for malformed sensor topic', async () => {
      await expect(
        service.ingestSensorTelemetry('invalid/topic/pattern', { test: true }),
      ).rejects.toThrow(InvalidPayloadException);
    });

    it('throws InvalidPayloadException for invalid payload content', async () => {
      const topic = 'hotel/prop_1/room/101/sensor/pir';
      const badPayload = {
        deviceId: 'pir_01',
        // missing gatewayId, sensorType, value, occurredAt
      };

      await expect(service.ingestSensorTelemetry(topic, badPayload)).rejects.toThrow(
        InvalidPayloadException,
      );
    });
  });

  describe('ingestHeartbeat', () => {
    it('successfully ingests valid gateway heartbeat payload', async () => {
      const topic = 'hotel/prop_1/gateway/gw_01/heartbeat';
      const payload = {
        version: '1.0',
        gatewayId: 'gw_01',
        ipAddress: '192.168.1.100',
        macAddress: '98:CD:AC:12:34:56',
        firmwareVersion: 'v2.1.4',
        uptimeSeconds: 3600,
        wifiRssi: -60,
        freeHeapBytes: 150000,
        connectedNodesCount: 5,
        batteryBackupPercent: 100,
        timestamp: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestHeartbeat(topic, payload);

      expect(event.propertyId).toBe('prop_1');
      expect(event.gatewayId).toBe('gw_01');
      expect(event.uptimeSeconds).toBe(3600);
      expect(event.timestamp).toEqual(new Date('2026-08-21T16:00:00.000Z'));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('device.heartbeat', event);
    });

    it('throws InvalidPayloadException for invalid heartbeat topic', async () => {
      await expect(service.ingestHeartbeat('invalid/heartbeat', {})).rejects.toThrow(
        InvalidPayloadException,
      );
    });

    it('throws InvalidPayloadException for invalid heartbeat payload', async () => {
      const topic = 'hotel/prop_1/gateway/gw_01/heartbeat';
      await expect(service.ingestHeartbeat(topic, { bad: 'data' })).rejects.toThrow(
        InvalidPayloadException,
      );
    });
  });

  describe('ingestEmergencyAlert', () => {
    it('successfully ingests life-safety emergency alert', async () => {
      const topic = 'hotel/prop_1/room/101/emergency';
      const payload = {
        version: '1.0',
        eventId: 'evt_001',
        gatewayId: 'gw_01',
        deviceId: 'smoke_01',
        alertType: 'SMOKE',
        severity: 'CRITICAL',
        details: { rawValue: 450 },
        triggeredAt: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestEmergencyAlert(topic, payload);

      expect(event.propertyId).toBe('prop_1');
      expect(event.roomId).toBe('101');
      expect(event.alertType).toBe('SMOKE');
      expect(event.severity).toBe('CRITICAL');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('emergency.event', event);
    });

    it('throws InvalidPayloadException for invalid emergency topic', async () => {
      await expect(service.ingestEmergencyAlert('invalid/emergency', {})).rejects.toThrow(
        InvalidPayloadException,
      );
    });

    it('throws InvalidPayloadException for malformed emergency payload', async () => {
      const topic = 'hotel/prop_1/room/101/emergency';
      await expect(service.ingestEmergencyAlert(topic, { bad: 'data' })).rejects.toThrow(
        InvalidPayloadException,
      );
    });
  });

  describe('ingestCommandAck', () => {
    it('successfully ingests command execution acknowledgement', async () => {
      const topic = 'hotel/prop_1/room/101/ack/set_relay';
      const payload = {
        commandId: 'cmd_123',
        action: 'set_relay',
        targetDeviceId: 'relay_01',
        status: 'SUCCESS',
        result: { channel: 1, state: 'ON' },
        errorMessage: null,
        acknowledgedAt: '2026-08-21T16:00:05.000Z',
      };

      const event = await service.ingestCommandAck(topic, payload);

      expect(event.propertyId).toBe('prop_1');
      expect(event.roomId).toBe('101');
      expect(event.action).toBe('set_relay');
      expect(event.status).toBe('SUCCESS');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('command.ack', event);
    });

    it('throws InvalidPayloadException for invalid ack topic', async () => {
      await expect(service.ingestCommandAck('invalid/ack', {})).rejects.toThrow(
        InvalidPayloadException,
      );
    });

    it('throws InvalidPayloadException for malformed ack payload', async () => {
      const topic = 'hotel/prop_1/room/101/ack/set_relay';
      await expect(service.ingestCommandAck(topic, { status: 'INVALID_STATUS' })).rejects.toThrow(
        InvalidPayloadException,
      );
    });
  });

  describe('ingestDeviceError', () => {
    it('successfully ingests gateway fault error diagnostics', async () => {
      const topic = 'hotel/prop_1/gateway/gw_01/errors';
      const payload = {
        version: '1.0',
        gatewayId: 'gw_01',
        deviceId: 'temp_01',
        errorCode: 'ERR_I2C_TIMEOUT',
        description: 'I2C bus timeout on sensor',
        occurredAt: '2026-08-21T16:00:00.000Z',
      };

      const event = await service.ingestDeviceError(topic, payload);

      expect(event.propertyId).toBe('prop_1');
      expect(event.gatewayId).toBe('gw_01');
      expect(event.errorCode).toBe('ERR_I2C_TIMEOUT');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('device.error', event);
    });

    it('throws InvalidPayloadException for invalid error topic', async () => {
      await expect(service.ingestDeviceError('invalid/error', {})).rejects.toThrow(
        InvalidPayloadException,
      );
    });

    it('throws InvalidPayloadException for malformed error payload', async () => {
      const topic = 'hotel/prop_1/gateway/gw_01/errors';
      await expect(service.ingestDeviceError(topic, { bad: 'data' })).rejects.toThrow(
        InvalidPayloadException,
      );
    });
  });
});
