import { Type, Static } from '@sinclair/typebox';

export const DeviceTypeSchema = Type.Union([
  Type.Literal('PIR'),
  Type.Literal('DOOR'),
  Type.Literal('TEMPERATURE'),
  Type.Literal('RELAY'),
  Type.Literal('GATEWAY'),
  Type.Literal('SMOKE'),
  Type.Literal('WATER_LEAK'),
  Type.Literal('PANIC_BUTTON'),
]);

export const DeviceStatusSchema = Type.Union([
  Type.Literal('ONLINE'),
  Type.Literal('OFFLINE'),
  Type.Literal('DEGRADED'),
  Type.Literal('UNPROVISIONED'),
]);

export const CreateDeviceDtoSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    description: 'Unique device identifier (e.g. gw_floor2_001 or MAC-based ID)',
  }),
  macAddress: Type.Optional(Type.String({ description: 'Hardware MAC address' })),
  type: DeviceTypeSchema,
  propertyId: Type.String({
    minLength: 1,
    description: 'UUID of the property this device belongs to',
  }),
  roomId: Type.Optional(
    Type.String({ description: 'Optional UUID of the room this device is installed in' }),
  ),
  firmwareVersion: Type.Optional(Type.String({ description: 'Current firmware version' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type CreateDeviceDto = Static<typeof CreateDeviceDtoSchema>;

export const UpdateDeviceDtoSchema = Type.Object({
  type: Type.Optional(DeviceTypeSchema),
  status: Type.Optional(DeviceStatusSchema),
  roomId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  firmwareVersion: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type UpdateDeviceDto = Static<typeof UpdateDeviceDtoSchema>;

export const SendCommandDtoSchema = Type.Object({
  action: Type.String({
    minLength: 1,
    description: 'Command action (e.g. set_relay, reboot, set_temp_threshold)',
  }),
  parameters: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type SendCommandDto = Static<typeof SendCommandDtoSchema>;

export const ListDevicesQuerySchema = Type.Object({
  propertyId: Type.Optional(Type.String()),
  roomId: Type.Optional(Type.String()),
  status: Type.Optional(DeviceStatusSchema),
  type: Type.Optional(DeviceTypeSchema),
});

export type ListDevicesQuery = Static<typeof ListDevicesQuerySchema>;
