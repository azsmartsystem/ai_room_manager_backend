import { Type, Static } from '@sinclair/typebox';

export const AssignDeviceDtoSchema = Type.Object({
  deviceId: Type.String(),
});

export type AssignDeviceDto = Static<typeof AssignDeviceDtoSchema>;
