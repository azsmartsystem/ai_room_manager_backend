import { Type, Static } from '@sinclair/typebox';

export const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
    { default: 'development' },
  ),
  PORT: Type.String({ default: '3000' }),
  DATABASE_URL: Type.String(),
  JWT_ACCESS_SECRET: Type.String({ minLength: 16 }),
  JWT_REFRESH_SECRET: Type.String({ minLength: 16 }),
  JWT_ACCESS_EXPIRES_IN: Type.Optional(Type.String({ default: '15m' })),
  JWT_REFRESH_EXPIRES_IN: Type.Optional(Type.String({ default: '7d' })),
  MQTT_BROKER_URL: Type.Optional(Type.String()),
  MQTT_TLS_CA_CERT_PATH: Type.Optional(Type.String()),
  MQTT_TLS_CLIENT_CERT_PATH: Type.Optional(Type.String()),
  MQTT_TLS_CLIENT_KEY_PATH: Type.Optional(Type.String()),
});

export type Env = Static<typeof EnvSchema>;
