import { SensorType } from '../topics/topic.registry';
import {
  PirSensorPayload,
  DoorSensorPayload,
  TemperatureSensorPayload,
  RelaySensorPayload,
} from '../topics/topic-schema';

export type NormalizedSensorValue =
  | PirSensorPayload['value']
  | DoorSensorPayload['value']
  | TemperatureSensorPayload['value']
  | RelaySensorPayload['value'];

export interface SensorEvent {
  propertyId: string;
  roomId: string;
  sensorType: SensorType;
  deviceId: string;
  gatewayId: string;
  value: NormalizedSensorValue;
  occurredAt: Date;
  rawPayload: unknown;
}

export interface DeviceHeartbeatEvent {
  propertyId: string;
  gatewayId: string;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  uptimeSeconds: number;
  wifiRssi?: number;
  freeHeapBytes?: number;
  connectedNodesCount?: number;
  batteryBackupPercent?: number;
  timestamp: Date;
  rawPayload: unknown;
}

export interface EmergencySensorEvent {
  propertyId: string;
  roomId: string;
  eventId: string;
  gatewayId: string;
  deviceId: string;
  alertType: 'SMOKE' | 'FIRE' | 'MEDICAL' | 'PANIC' | 'INTRUSION' | 'WATER_LEAK' | 'DEVICE_FAILURE';
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  details?: Record<string, unknown>;
  triggeredAt: Date;
  rawPayload: unknown;
}

export interface CommandAckEvent {
  propertyId: string;
  roomId: string;
  action: string;
  commandId: string;
  targetDeviceId: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'REJECTED';
  result?: Record<string, unknown>;
  errorMessage?: string | null;
  acknowledgedAt: Date;
  rawPayload: unknown;
}

export interface DeviceErrorEvent {
  propertyId: string;
  gatewayId: string;
  deviceId?: string;
  errorCode: string;
  description: string;
  occurredAt: Date;
  rawPayload: unknown;
}
