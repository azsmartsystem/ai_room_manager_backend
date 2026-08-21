import { Type, Static } from '@sinclair/typebox';

export const RoleEnum = Type.Union([
  Type.Literal('SUPER_ADMIN'),
  Type.Literal('PROPERTY_MANAGER'),
  Type.Literal('FRONT_DESK'),
  Type.Literal('HOUSEKEEPING'),
  Type.Literal('MAINTENANCE'),
  Type.Literal('SECURITY'),
]);

export const CreateUserDtoSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  firstName: Type.String({ minLength: 1 }),
  lastName: Type.String({ minLength: 1 }),
  role: RoleEnum,
  propertyId: Type.Optional(Type.String()),
});

export type CreateUserDto = Static<typeof CreateUserDtoSchema>;
