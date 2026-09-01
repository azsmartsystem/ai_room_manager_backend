import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Value } from '@sinclair/typebox/value';
import { TopicRegistry, SensorType } from '../topics/topic.registry';
import {
  PirSensorPayloadSchema,
  DoorSensorPayloadSchema,
  TemperatureSensorPayloadSchema,
  RelaySensorPayloadSchema,
  HeartbeatPayloadSchema,
  EmergencyAlertPayloadSchema,
  CommandAckPayloadSchema,
  DeviceErrorPayloadSchema,
  PirSensorPayload,
  DoorSensorPayload,
  TemperatureSensorPayload,
  RelaySensorPayload,
  HeartbeatPayload,
  EmergencyAlertPayload,
  CommandAckPayload,
  DeviceErrorPayload,
} from '../topics/topic-schema';
import {
  SensorEvent,
  DeviceHeartbeatEvent,
  EmergencySensorEvent,
  CommandAckEvent,
  DeviceErrorEvent,
} from '../events/sensor-event';
import { InvalidPayloadException } from '../../common/exceptions/iot/invalid-payload.exception';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Ingests and normalizes raw sensor telemetry messages.
   * Validates against TypeBox schema corresponding to sensorType.
   */
  async ingestSensorTelemetry(topic: string, rawPayload: unknown): Promise<SensorEvent> {
    const parsedTopic = TopicRegistry.parseSensorTopic(topic);
    if (!parsedTopic) {
      throw new InvalidPayloadException(topic, rawPayload, 'Invalid sensor topic pattern');
    }

    const { propertyId, roomId, sensorType } = parsedTopic;
    const validated = this.validateSensorPayload(sensorType, topic, rawPayload);

    const event: SensorEvent = {
      propertyId,
      roomId,
      sensorType,
      deviceId: validated.deviceId,
      gatewayId: validated.gatewayId,
      value: validated.value,
      occurredAt: new Date(validated.occurredAt),
      rawPayload,
    };

    this.logger.log({
      event: 'SENSOR_PAYLOAD_INGESTED',
      propertyId,
      roomId,
      sensorType,
      deviceId: event.deviceId,
      gatewayId: event.gatewayId,
    });

    this.eventEmitter.emit('sensor.event', event);
    return event;
  }

  /**
   * Ingests gateway / device heartbeat telemetry.
   */
  async ingestHeartbeat(topic: string, rawPayload: unknown): Promise<DeviceHeartbeatEvent> {
    const parsedTopic = TopicRegistry.parseHeartbeatTopic(topic);
    if (!parsedTopic) {
      throw new InvalidPayloadException(topic, rawPayload, 'Invalid heartbeat topic pattern');
    }

    const { propertyId, gatewayId } = parsedTopic;
    const errors = [...Value.Errors(HeartbeatPayloadSchema, rawPayload)];
    if (errors.length > 0) {
      this.logger.warn({
        event: 'HEARTBEAT_VALIDATION_FAILED',
        topic,
        errors,
      });
      throw new InvalidPayloadException(topic, rawPayload, errors);
    }

    const validated = Value.Cast(HeartbeatPayloadSchema, rawPayload) as HeartbeatPayload;

    const event: DeviceHeartbeatEvent = {
      propertyId,
      gatewayId,
      ipAddress: validated.ipAddress,
      macAddress: validated.macAddress,
      firmwareVersion: validated.firmwareVersion,
      uptimeSeconds: validated.uptimeSeconds,
      wifiRssi: validated.wifiRssi,
      freeHeapBytes: validated.freeHeapBytes,
      connectedNodesCount: validated.connectedNodesCount,
      batteryBackupPercent: validated.batteryBackupPercent,
      timestamp: new Date(validated.timestamp),
      rawPayload,
    };

    this.logger.debug?.({
      event: 'HEARTBEAT_INGESTED',
      propertyId,
      gatewayId,
      firmwareVersion: event.firmwareVersion,
    });

    this.eventEmitter.emit('device.heartbeat', event);
    return event;
  }

  /**
   * Ingests emergency and life-safety alert payloads.
   */
  async ingestEmergencyAlert(topic: string, rawPayload: unknown): Promise<EmergencySensorEvent> {
    const parsedTopic = TopicRegistry.parseEmergencyTopic(topic);
    if (!parsedTopic) {
      throw new InvalidPayloadException(topic, rawPayload, 'Invalid emergency topic pattern');
    }

    const { propertyId, roomId } = parsedTopic;
    const errors = [...Value.Errors(EmergencyAlertPayloadSchema, rawPayload)];
    if (errors.length > 0) {
      this.logger.error({
        event: 'EMERGENCY_PAYLOAD_VALIDATION_FAILED',
        topic,
        errors,
      });
      throw new InvalidPayloadException(topic, rawPayload, errors);
    }

    const validated = Value.Cast(EmergencyAlertPayloadSchema, rawPayload) as EmergencyAlertPayload;

    const event: EmergencySensorEvent = {
      propertyId,
      roomId,
      eventId: validated.eventId,
      gatewayId: validated.gatewayId,
      deviceId: validated.deviceId,
      alertType: validated.alertType,
      severity: validated.severity,
      details: validated.details as Record<string, unknown> | undefined,
      triggeredAt: new Date(validated.triggeredAt),
      rawPayload,
    };

    this.logger.log({
      event: 'EMERGENCY_ALERT_INGESTED',
      propertyId,
      roomId,
      alertType: event.alertType,
      severity: event.severity,
      deviceId: event.deviceId,
    });

    this.eventEmitter.emit('emergency.event', event);
    return event;
  }

  /**
   * Ingests command execution acknowledgements from edge devices.
   */
  async ingestCommandAck(topic: string, rawPayload: unknown): Promise<CommandAckEvent> {
    const parsedTopic = TopicRegistry.parseAckTopic(topic);
    if (!parsedTopic) {
      throw new InvalidPayloadException(topic, rawPayload, 'Invalid command ack topic pattern');
    }

    const { propertyId, roomId, action } = parsedTopic;
    const errors = [...Value.Errors(CommandAckPayloadSchema, rawPayload)];
    if (errors.length > 0) {
      this.logger.warn({
        event: 'COMMAND_ACK_VALIDATION_FAILED',
        topic,
        errors,
      });
      throw new InvalidPayloadException(topic, rawPayload, errors);
    }

    const validated = Value.Cast(CommandAckPayloadSchema, rawPayload) as CommandAckPayload;

    const event: CommandAckEvent = {
      propertyId,
      roomId,
      action,
      commandId: validated.commandId,
      targetDeviceId: validated.targetDeviceId,
      status: validated.status,
      result: validated.result as Record<string, unknown> | undefined,
      errorMessage: validated.errorMessage,
      acknowledgedAt: new Date(validated.acknowledgedAt),
      rawPayload,
    };

    this.logger.log({
      event: 'COMMAND_ACK_INGESTED',
      propertyId,
      roomId,
      action,
      status: event.status,
      commandId: event.commandId,
    });

    this.eventEmitter.emit('command.ack', event);
    return event;
  }

  /**
   * Ingests hardware fault and error diagnostics from gateways.
   */
  async ingestDeviceError(topic: string, rawPayload: unknown): Promise<DeviceErrorEvent> {
    const parsedTopic = TopicRegistry.parseErrorTopic(topic);
    if (!parsedTopic) {
      throw new InvalidPayloadException(topic, rawPayload, 'Invalid error topic pattern');
    }

    const { propertyId, gatewayId } = parsedTopic;
    const errors = [...Value.Errors(DeviceErrorPayloadSchema, rawPayload)];
    if (errors.length > 0) {
      this.logger.warn({
        event: 'DEVICE_ERROR_VALIDATION_FAILED',
        topic,
        errors,
      });
      throw new InvalidPayloadException(topic, rawPayload, errors);
    }

    const validated = Value.Cast(DeviceErrorPayloadSchema, rawPayload) as DeviceErrorPayload;

    const event: DeviceErrorEvent = {
      propertyId,
      gatewayId,
      deviceId: validated.deviceId,
      errorCode: validated.errorCode,
      description: validated.description,
      occurredAt: new Date(validated.occurredAt),
      rawPayload,
    };

    this.logger.warn({
      event: 'DEVICE_FAULT_INGESTED',
      propertyId,
      gatewayId,
      deviceId: event.deviceId,
      errorCode: event.errorCode,
    });

    this.eventEmitter.emit('device.error', event);
    return event;
  }

  // ─── Private Validator Helper ───────────────────────────────────────────────

  private validateSensorPayload(
    sensorType: SensorType,
    topic: string,
    rawPayload: unknown,
  ): PirSensorPayload | DoorSensorPayload | TemperatureSensorPayload | RelaySensorPayload {
    let schema;
    switch (sensorType) {
      case 'pir':
        schema = PirSensorPayloadSchema;
        break;
      case 'door':
        schema = DoorSensorPayloadSchema;
        break;
      case 'temperature':
        schema = TemperatureSensorPayloadSchema;
        break;
      case 'relay':
        schema = RelaySensorPayloadSchema;
        break;
      default:
        throw new InvalidPayloadException(
          topic,
          rawPayload,
          `Unsupported sensor type '${sensorType}'`,
        );
    }

    const errors = [...Value.Errors(schema, rawPayload)];
    if (errors.length > 0) {
      this.logger.warn({
        event: 'IOT_INVALID_PAYLOAD',
        topic,
        sensorType,
        errors,
      });
      throw new InvalidPayloadException(topic, rawPayload, errors);
    }

    return Value.Cast(schema, rawPayload) as
      PirSensorPayload | DoorSensorPayload | TemperatureSensorPayload | RelaySensorPayload;
  }
}
