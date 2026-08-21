import { AppConfigService } from './config.service';

describe('AppConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize and provide typed config getters in development', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/db',
      JWT_ACCESS_SECRET: 'access-secret-32-chars-minimum-length!',
      JWT_REFRESH_SECRET: 'refresh-secret-32-chars-minimum-length!',
      JWT_ACCESS_EXPIRES_IN: '30m',
      JWT_REFRESH_EXPIRES_IN: '14d',
    };

    const config = new AppConfigService();

    expect(config.nodeEnv).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(3000);
    expect(config.jwtAccessSecret).toBe('access-secret-32-chars-minimum-length!');
    expect(config.jwtRefreshSecret).toBe('refresh-secret-32-chars-minimum-length!');
    expect(config.jwtAccessExpiresIn).toBe('30m');
    expect(config.jwtRefreshExpiresIn).toBe('14d');
    expect(config.get('PORT')).toBe('3000');
  });

  it('should handle production environment and fallback defaults', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: 'postgresql://prod:prod@localhost:5432/db',
      JWT_ACCESS_SECRET: 'access-secret-32-chars-minimum-length!',
      JWT_REFRESH_SECRET: 'refresh-secret-32-chars-minimum-length!',
    };
    delete process.env['JWT_ACCESS_EXPIRES_IN'];
    delete process.env['JWT_REFRESH_EXPIRES_IN'];

    const config = new AppConfigService();

    expect(config.nodeEnv).toBe('production');
    expect(config.isProduction).toBe(true);
    expect(config.port).toBe(8080);
    expect(config.jwtAccessExpiresIn).toBe('15m');
    expect(config.jwtRefreshExpiresIn).toBe('7d');
  });

  it('should throw when required environment config is invalid', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'invalid_env' as unknown as string,
    };

    expect(() => new AppConfigService()).toThrow();
  });
});
