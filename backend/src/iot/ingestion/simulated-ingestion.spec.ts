import { EventEmitter2 } from '@nestjs/event-emitter';
import { MqttService } from '../mqtt/mqtt.service';
import { IngestionService } from './ingestion.service';
import { SensorEventSubscriber } from '../subscribers/sensor-event.subscriber';
import { HeartbeatSubscriber } from '../subscribers/heartbeat.subscriber';
import { AppConfigService } from '../../config/config.service';
import { EventEmitter } from 'events';
import { SensorEvent, DeviceHeartbeatEvent, EmergencySensorEvent } from '../events/sensor-event';

class SimulatedMqttClient extends EventEmitter {
  subscribe = jest.fn((topic, opts, cb) => {
    if (cb) cb();
    return this;
  });
  publish = jest.fn((topic, msg, opts, cb) => {
    if (cb) cb();
    return this;
  });
  end = jest.fn((force, opts, cb) => {
    if (cb) cb();
    return this;
  });

  simulateIncomingMqttMessage(topic: string, payload: unknown) {
    const buffer = Buffer.from(JSON.stringify(payload));
    this.emit('message', topic, buffer);
  }
}

describe('Simulated MQTT Ingestion Pipeline (Integration)', () => {
  let eventEmitter: EventEmitter2;
  let simulatedClient: SimulatedMqttClient;
  let mqttService: MqttService;
  let ingestionService: IngestionService;
  let sensorSubscriber: SensorEventSubscriber;
  let heartbeatSubscriber: HeartbeatSubscriber;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    simulatedClient = new SimulatedMqttClient();

    const mockConfigService = {
      get: jest.fn().mockReturnValue('mqtt://localhost:1883'),
    } as unknown as AppConfigService;

    mqttService = new MqttService(
      mockConfigService,
      simulatedClient as unknown as import('mqtt').MqttClient,
    );
    ingestionService = new IngestionService(eventEmitter);

    sensorSubscriber = new SensorEventSubscriber(mqttService, ingestionService);
    heartbeatSubscriber = new HeartbeatSubscriber(mqttService, ingestionService);

    // Initialize services
    mqttService.onModuleInit();
    sensorSubscriber.onModuleInit();
    heartbeatSubscriber.onModuleInit();
  });

  it('end-to-end: simulated PIR motion sensor MQTT message triggers normalized SensorEvent', (done) => {
    const topic = 'hotel/prop_lagos_01/room/room_204/sensor/pir';
    const rawPayload = {
      version: '1.0',
      deviceId: 'pir_esp32_01_a9f2',
      gatewayId: 'gw_floor2_001',
      sensorType: 'pir',
      value: {
        motionDetected: true,
        confidenceScore: 0.98,
        durationMs: 4200,
      },
      occurredAt: '2026-08-21T16:00:00.000Z',
    };

    eventEmitter.on('sensor.event', (event: SensorEvent) => {
      expect(event.propertyId).toBe('prop_lagos_01');
      expect(event.roomId).toBe('room_204');
      expect(event.sensorType).toBe('pir');
      expect(event.deviceId).toBe('pir_esp32_01_a9f2');
      expect(event.value).toEqual({
        motionDetected: true,
        confidenceScore: 0.98,
        durationMs: 4200,
      });
      expect(event.occurredAt).toEqual(new Date('2026-08-21T16:00:00.000Z'));
      done();
    });

    simulatedClient.simulateIncomingMqttMessage(topic, rawPayload);
  });

  it('end-to-end: simulated Door sensor MQTT message triggers normalized SensorEvent', (done) => {
    const topic = 'hotel/prop_lagos_01/room/room_204/sensor/door';
    const rawPayload = {
      version: '1.0',
      deviceId: 'door_contact_01_b12c',
      gatewayId: 'gw_floor2_001',
      sensorType: 'door',
      value: {
        state: 'OPEN',
        durationInPreviousStateSec: 3600,
      },
      occurredAt: '2026-08-21T16:00:05.120Z',
    };

    eventEmitter.on('sensor.event', (event: SensorEvent) => {
      expect(event.sensorType).toBe('door');
      expect(event.value).toEqual({
        state: 'OPEN',
        durationInPreviousStateSec: 3600,
      });
      done();
    });

    simulatedClient.simulateIncomingMqttMessage(topic, rawPayload);
  });

  it('end-to-end: simulated Gateway Heartbeat MQTT message triggers DeviceHeartbeatEvent', (done) => {
    const topic = 'hotel/prop_lagos_01/gateway/gw_floor2_001/heartbeat';
    const rawPayload = {
      version: '1.0',
      gatewayId: 'gw_floor2_001',
      ipAddress: '192.168.10.45',
      macAddress: '98:CD:AC:12:34:56',
      firmwareVersion: 'v2.1.4-prod',
      uptimeSeconds: 86400,
      wifiRssi: -58,
      freeHeapBytes: 148200,
      connectedNodesCount: 8,
      batteryBackupPercent: 100,
      timestamp: '2026-08-21T16:00:30.000Z',
    };

    eventEmitter.on('device.heartbeat', (event: DeviceHeartbeatEvent) => {
      expect(event.propertyId).toBe('prop_lagos_01');
      expect(event.gatewayId).toBe('gw_floor2_001');
      expect(event.uptimeSeconds).toBe(86400);
      expect(event.firmwareVersion).toBe('v2.1.4-prod');
      done();
    });

    simulatedClient.simulateIncomingMqttMessage(topic, rawPayload);
  });

  it('end-to-end: simulated Life-Safety Emergency Alert triggers EmergencySensorEvent', (done) => {
    const topic = 'hotel/prop_lagos_01/room/room_204/emergency';
    const rawPayload = {
      version: '1.0',
      eventId: 'evt_emg_98234ab1',
      gatewayId: 'gw_floor2_001',
      deviceId: 'smoke_sensor_01_d90e',
      alertType: 'SMOKE',
      severity: 'CRITICAL',
      details: {
        sensorRawValue: 450,
        thresholdValue: 200,
      },
      triggeredAt: '2026-08-21T16:01:10.000Z',
    };

    eventEmitter.on('emergency.event', (event: EmergencySensorEvent) => {
      expect(event.propertyId).toBe('prop_lagos_01');
      expect(event.roomId).toBe('room_204');
      expect(event.alertType).toBe('SMOKE');
      expect(event.severity).toBe('CRITICAL');
      expect(event.details).toEqual({ sensorRawValue: 450, thresholdValue: 200 });
      done();
    });

    simulatedClient.simulateIncomingMqttMessage(topic, rawPayload);
  });
});
