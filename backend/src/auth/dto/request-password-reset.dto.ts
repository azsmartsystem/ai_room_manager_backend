import { Type, Static } from '@sinclair/typebox';

export const RequestPasswordResetDtoSchema = Type.Object({
  email: Type.String({ format: 'email' }),
});

export type RequestPasswordResetDto = Static<typeof RequestPasswordResetDtoSchema>;
