import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LatencyLoggerMiddleware } from './common/middleware/latency-logger.middleware';

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

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}

bootstrap();
