import { Type, Static } from '@sinclair/typebox';
import {
  PirSensorPayloadSchema,
  DoorSensorPayloadSchema,
  TemperatureSensorPayloadSchema,
  RelaySensorPayloadSchema,
} from '../../topics/topic-schema';

export const AnySensorPayloadSchema = Type.Union([
  PirSensorPayloadSchema,
  DoorSensorPayloadSchema,
  TemperatureSensorPayloadSchema,
  RelaySensorPayloadSchema,
]);

export type AnySensorPayload = Static<typeof AnySensorPayloadSchema>;
export * from '../../topics/topic-schema';
