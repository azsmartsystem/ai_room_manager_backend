import { Type, Static } from '@sinclair/typebox';

export const CreateBuildingDtoSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
});

export const UpdateBuildingDtoSchema = Type.Partial(CreateBuildingDtoSchema);

export type CreateBuildingDto = Static<typeof CreateBuildingDtoSchema>;
export type UpdateBuildingDto = Static<typeof UpdateBuildingDtoSchema>;
