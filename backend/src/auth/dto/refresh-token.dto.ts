import { Type, Static } from '@sinclair/typebox';

export const RefreshTokenDtoSchema = Type.Object({
  refreshToken: Type.String({ minLength: 1 }),
});

export type RefreshTokenDto = Static<typeof RefreshTokenDtoSchema>;
