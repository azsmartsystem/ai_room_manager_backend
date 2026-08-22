import { Type, Static } from '@sinclair/typebox';

export const CreatePropertyDtoSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100 }),
  code: Type.String({ minLength: 2, maxLength: 20 }),
  address: Type.String({ minLength: 3, maxLength: 255 }),
  city: Type.String({ minLength: 2, maxLength: 100 }),
  country: Type.String({ minLength: 2, maxLength: 100 }),
});

export const UpdatePropertyDtoSchema = Type.Partial(CreatePropertyDtoSchema);

export type CreatePropertyDto = Static<typeof CreatePropertyDtoSchema>;
export type UpdatePropertyDto = Static<typeof UpdatePropertyDtoSchema>;
