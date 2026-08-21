import { Injectable, Logger } from '@nestjs/common';
import { Value } from '@sinclair/typebox/value';
import { EnvSchema, Env } from './env.schema';

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly env: Env;

  constructor() {
    const rawEnv = {
      NODE_ENV: process.env['NODE_ENV'] ?? 'development',
      PORT: process.env['PORT'] ?? '3000',
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      JWT_ACCESS_SECRET:
        process.env['JWT_ACCESS_SECRET'] ?? 'default-jwt-access-secret-32-chars-min',
      JWT_REFRESH_SECRET:
        process.env['JWT_REFRESH_SECRET'] ?? 'default-jwt-refresh-secret-32-chars-min',
      JWT_ACCESS_EXPIRES_IN: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
      JWT_REFRESH_EXPIRES_IN: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
      MQTT_BROKER_URL: process.env['MQTT_BROKER_URL'],
      MQTT_TLS_CA_CERT_PATH: process.env['MQTT_TLS_CA_CERT_PATH'],
      MQTT_TLS_CLIENT_CERT_PATH: process.env['MQTT_TLS_CLIENT_CERT_PATH'],
      MQTT_TLS_CLIENT_KEY_PATH: process.env['MQTT_TLS_CLIENT_KEY_PATH'],
    };

    const errors = [...Value.Errors(EnvSchema, rawEnv)];
    if (errors.length > 0) {
      this.logger.error({
        event: 'CONFIG_VALIDATION_FAILED',
        errors: errors.map((e) => ({ path: e.path, message: e.message })),
      });
      throw new Error(`Config validation failed: ${JSON.stringify(errors)}`);
    }

    this.env = Value.Cast(EnvSchema, rawEnv);
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get nodeEnv(): 'development' | 'production' | 'test' {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return parseInt(this.env.PORT, 10);
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get jwtAccessExpiresIn(): string {
    return this.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  }

  get jwtRefreshExpiresIn(): string {
    return this.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  }
}
