import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LatencyLoggerMiddleware } from './common/middleware/latency-logger.middleware';
import {
  AuthResponse,
  UserResponse,
  PropertyResponse,
  BuildingResponse,
  FloorResponse,
  RoomResponse,
} from './common/dto/swagger-schemas';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  // ── Latency logging (logs method, URL, status, ms for every request) ────────
  const latencyMw = new LatencyLoggerMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => latencyMw.use(req, res, next));

  // ── Global exception filter ─────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS (tighten allowedOrigins in production via env var) ─────────────────
  app.enableCors();

  // ── API versioning prefix ───────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger / OpenAPI ───────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('AI Room Manager API')
    .setDescription(
      'Enterprise IoT Hospitality Operations Platform API.\n\n' +
        '## Authentication\n' +
        'All endpoints except `/auth/login`, `/auth/refresh`, and `/auth/password-reset/*` require a valid JWT Bearer token.\n\n' +
        '## Roles\n' +
        '| Role | Description |\n' +
        '| --- | --- |\n' +
        '| `SUPER_ADMIN` | Full system access — manages properties, users, and system-wide settings |\n' +
        '| `PROPERTY_MANAGER` | Manages buildings, floors, rooms, and housekeeping/maintenance staff for assigned properties |\n' +
        '| `FRONT_DESK` | Views room status, checks guests in/out, triggers room status changes |\n' +
        '| `HOUSEKEEPING` | Views assigned rooms, updates cleaning status |\n' +
        '| `MAINTENANCE` | Views assigned tickets, updates maintenance status |\n' +
        '| `SECURITY` | Views emergency alerts, acknowledges and escalates alerts |',
    )
    .setVersion('1.0.0')
    .setContact('ALLINZUCOLSMART SYSTEMS LTD', 'https://azsmartsystem.com', 'dev@azsmartsystem.com')
    .setLicense('Proprietary', 'https://azsmartsystem.com/license')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.yourdomain.com', 'Production')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'jwt-access',
    )
    .addTag('Auth', 'Authentication — login, token refresh, password reset')
    .addTag('Properties', 'Property, building, floor, and room hierarchy management')
    .addTag('Rooms', 'Room status and device assignment')
    .addTag('Users', 'User management (coming soon)')
    .addTag('IoT Devices', 'Device registration, assignment, and command dispatch')
    .addTag('IoT Telemetry', 'Sensor ingestion, heartbeat, and device error events')
    .addTag('Occupancy', 'Real-time occupancy tracking and limit enforcement')
    .addTag('Housekeeping', 'Cleaning task lifecycle management')
    .addTag('Maintenance', 'Maintenance ticket lifecycle management')
    .addTag('DND', 'Do Not Disturb rule enforcement')
    .addTag('Emergency', 'Emergency alert system — trigger, escalate, acknowledge')
    .addTag('Dashboard', 'Aggregated dashboard data queries')
    .addTag('Notifications', 'Email and in-app notification dispatch')
    .addTag('Realtime', 'WebSocket gateway for live dashboard state')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      AuthResponse,
      UserResponse,
      PropertyResponse,
      BuildingResponse,
      FloorResponse,
      RoomResponse,
    ],
  });
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'AI Room Manager API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  logger.log('Swagger docs available at http://localhost:3000/docs');

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}

bootstrap();
