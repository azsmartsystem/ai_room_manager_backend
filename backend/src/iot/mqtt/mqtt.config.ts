import { Type, Static } from '@sinclair/typebox';

export const MqttConfigSchema = Type.Object({
  brokerUrl: Type.Optional(Type.String({ default: 'mqtt://localhost:1883' })),
  clientId: Type.Optional(Type.String({ default: 'ai-room-manager-backend' })),
  caCertPath: Type.Optional(Type.String()),
  clientCertPath: Type.Optional(Type.String()),
  clientKeyPath: Type.Optional(Type.String()),
  username: Type.Optional(Type.String()),
  password: Type.Optional(Type.String()),
  keepalive: Type.Optional(Type.Number({ default: 60 })),
  reconnectPeriod: Type.Optional(Type.Number({ default: 5000 })),
  connectTimeout: Type.Optional(Type.Number({ default: 30000 })),
  rejectUnauthorized: Type.Optional(Type.Boolean({ default: false })),
});

export type MqttConfig = Static<typeof MqttConfigSchema>;
