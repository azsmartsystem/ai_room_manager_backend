import { Type, Static } from '@sinclair/typebox';

export const ResetPasswordDtoSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 8 }),
});

export type ResetPasswordDto = Static<typeof ResetPasswordDtoSchema>;
