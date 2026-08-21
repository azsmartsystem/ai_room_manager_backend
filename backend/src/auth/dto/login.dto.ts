import { Type, Static } from '@sinclair/typebox';

export const LoginDtoSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 }),
});

export type LoginDto = Static<typeof LoginDtoSchema>;
