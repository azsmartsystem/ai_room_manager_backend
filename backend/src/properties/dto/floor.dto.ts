import { Type, Static } from '@sinclair/typebox';

export const CreateFloorDtoSchema = Type.Object({
  number: Type.Integer({ minimum: -5, maximum: 200 }),
  name: Type.Optional(Type.String({ maxLength: 100 })),
});

export const UpdateFloorDtoSchema = Type.Partial(CreateFloorDtoSchema);

export type CreateFloorDto = Static<typeof CreateFloorDtoSchema>;
export type UpdateFloorDto = Static<typeof UpdateFloorDtoSchema>;
