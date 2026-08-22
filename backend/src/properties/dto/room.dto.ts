import { Type, Static } from '@sinclair/typebox';

export const RoomStatusEnum = Type.Union([
  Type.Literal('VACANT_CLEAN'),
  Type.Literal('VACANT_DIRTY'),
  Type.Literal('OCCUPIED_CLEAN'),
  Type.Literal('OCCUPIED_DIRTY'),
  Type.Literal('OUT_OF_ORDER'),
  Type.Literal('MAINTENANCE_REQUIRED'),
]);

export const CreateRoomDtoSchema = Type.Object({
  number: Type.String({ minLength: 1, maxLength: 20 }),
  buildingId: Type.String(),
  floorId: Type.String(),
  maxOccupancy: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, default: 2 })),
  status: Type.Optional(RoomStatusEnum),
});

export const UpdateRoomDtoSchema = Type.Partial(
  Type.Object({
    number: Type.String({ minLength: 1, maxLength: 20 }),
    buildingId: Type.String(),
    floorId: Type.String(),
    maxOccupancy: Type.Integer({ minimum: 1, maximum: 20 }),
  }),
);

export const UpdateRoomStatusDtoSchema = Type.Object({
  status: RoomStatusEnum,
  reason: Type.Optional(Type.String({ maxLength: 255 })),
});

export type CreateRoomDto = Static<typeof CreateRoomDtoSchema>;
export type UpdateRoomDto = Static<typeof UpdateRoomDtoSchema>;
export type UpdateRoomStatusDto = Static<typeof UpdateRoomStatusDtoSchema>;
