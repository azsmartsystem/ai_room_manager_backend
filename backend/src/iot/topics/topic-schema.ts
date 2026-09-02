import { Type, Static, FormatRegistry } from '@sinclair/typebox';

if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value: string) => !isNaN(Date.parse(value)));
}

// ─── PIR Sensor Schema ────────────────────────────────────────────────────────
export const PirSensorValueSchema = Type.Object({
  motionDetected: Type.Boolean(),
  confidenceScore: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  durationMs: Type.Optional(Type.Number({ minimum: 0 })),
});

export const PirSensorPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  deviceId: Type.String({ minLength: 1 }),
  gatewayId: Type.String({ minLength: 1 }),
  sensorType: Type.Literal('pir'),
  value: PirSensorValueSchema,
  occurredAt: Type.String({ format: 'date-time' }),
});

export type PirSensorPayload = Static<typeof PirSensorPayloadSchema>;

// ─── Door Sensor Schema ───────────────────────────────────────────────────────
export const DoorSensorValueSchema = Type.Object({
  state: Type.Union([Type.Literal('OPEN'), Type.Literal('CLOSED')]),
  durationInPreviousStateSec: Type.Optional(Type.Number({ minimum: 0 })),
});

export const DoorSensorPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  deviceId: Type.String({ minLength: 1 }),
  gatewayId: Type.String({ minLength: 1 }),
  sensorType: Type.Literal('door'),
  value: DoorSensorValueSchema,
  occurredAt: Type.String({ format: 'date-time' }),
});

export type DoorSensorPayload = Static<typeof DoorSensorPayloadSchema>;

// ─── Temperature & Humidity Schema ───────────────────────────────────────────
export const TemperatureSensorValueSchema = Type.Object({
  temperatureCelsius: Type.Number(),
  humidityPercent: Type.Number({ minimum: 0, maximum: 100 }),
  batteryLevelPercent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
});

export const TemperatureSensorPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  deviceId: Type.String({ minLength: 1 }),
  gatewayId: Type.String({ minLength: 1 }),
  sensorType: Type.Literal('temperature'),
  value: TemperatureSensorValueSchema,
  occurredAt: Type.String({ format: 'date-time' }),
});

export type TemperatureSensorPayload = Static<typeof TemperatureSensorPayloadSchema>;

// ─── Relay Sensor Schema ──────────────────────────────────────────────────────
export const RelaySensorValueSchema = Type.Object({
  channel: Type.Number({ minimum: 1 }),
  relayState: Type.Union([Type.Literal('ON'), Type.Literal('OFF')]),
  currentAmps: Type.Optional(Type.Number({ minimum: 0 })),
  voltageVolts: Type.Optional(Type.Number({ minimum: 0 })),
  activePowerWatts: Type.Optional(Type.Number({ minimum: 0 })),
  accumulatedKWh: Type.Optional(Type.Number({ minimum: 0 })),
});

export const RelaySensorPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  deviceId: Type.String({ minLength: 1 }),
  gatewayId: Type.String({ minLength: 1 }),
  sensorType: Type.Literal('relay'),
  value: RelaySensorValueSchema,
  occurredAt: Type.String({ format: 'date-time' }),
});

export type RelaySensorPayload = Static<typeof RelaySensorPayloadSchema>;

// ─── Gateway Heartbeat Schema ─────────────────────────────────────────────────
export const HeartbeatPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  gatewayId: Type.String({ minLength: 1 }),
  ipAddress: Type.Optional(Type.String()),
  macAddress: Type.Optional(Type.String()),
  firmwareVersion: Type.Optional(Type.String()),
  uptimeSeconds: Type.Number({ minimum: 0 }),
  wifiRssi: Type.Optional(Type.Number()),
  freeHeapBytes: Type.Optional(Type.Number({ minimum: 0 })),
  connectedNodesCount: Type.Optional(Type.Number({ minimum: 0 })),
  batteryBackupPercent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  timestamp: Type.String({ format: 'date-time' }),
});

export type HeartbeatPayload = Static<typeof HeartbeatPayloadSchema>;

// ─── Emergency Alert Schema ───────────────────────────────────────────────────
export const EmergencyAlertPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  eventId: Type.String({ minLength: 1 }),
  gatewayId: Type.String({ minLength: 1 }),
  deviceId: Type.String({ minLength: 1 }),
  alertType: Type.Union([
    Type.Literal('SMOKE'),
    Type.Literal('FIRE'),
    Type.Literal('MEDICAL'),
    Type.Literal('PANIC'),
    Type.Literal('INTRUSION'),
    Type.Literal('WATER_LEAK'),
    Type.Literal('DEVICE_FAILURE'),
  ]),
  severity: Type.Union([Type.Literal('WARNING'), Type.Literal('HIGH'), Type.Literal('CRITICAL')]),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  triggeredAt: Type.String({ format: 'date-time' }),
});

export type EmergencyAlertPayload = Static<typeof EmergencyAlertPayloadSchema>;

// ─── Command Payload Schema ───────────────────────────────────────────────────
export const CommandPayloadSchema = Type.Object({
  commandId: Type.String({ minLength: 1 }),
  action: Type.String({ minLength: 1 }),
  targetDeviceId: Type.String({ minLength: 1 }),
  parameters: Type.Record(Type.String(), Type.Unknown()),
  issuedAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type CommandPayload = Static<typeof CommandPayloadSchema>;

// ─── Command ACK Payload Schema ───────────────────────────────────────────────
export const CommandAckPayloadSchema = Type.Object({
  commandId: Type.String({ minLength: 1 }),
  action: Type.String({ minLength: 1 }),
  targetDeviceId: Type.String({ minLength: 1 }),
  status: Type.Union([
    Type.Literal('SUCCESS'),
    Type.Literal('FAILED'),
    Type.Literal('TIMEOUT'),
    Type.Literal('REJECTED'),
  ]),
  result: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  errorMessage: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  acknowledgedAt: Type.String({ format: 'date-time' }),
});

export type CommandAckPayload = Static<typeof CommandAckPayloadSchema>;

// ─── Device Error Diagnostics Schema ──────────────────────────────────────────
export const DeviceErrorPayloadSchema = Type.Object({
  version: Type.Optional(Type.String({ default: '1.0' })),
  gatewayId: Type.String({ minLength: 1 }),
  deviceId: Type.Optional(Type.String()),
  errorCode: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  occurredAt: Type.String({ format: 'date-time' }),
});

export type DeviceErrorPayload = Static<typeof DeviceErrorPayloadSchema>;
