import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import responseTime from 'response-time';

/**
 * LatencyLoggerMiddleware
 *
 * Logs the HTTP method, URL, response status, and wall-clock latency (ms)
 * for every inbound request. Uses the `response-time` npm package which
 * measures from request receipt to the moment response headers are flushed.
 *
 * Log level reflects the outcome:
 *   - 2xx / 3xx  -> Logger.log
 *   - 4xx        -> Logger.warn
 *   - 5xx        -> Logger.error
 *
 * Registered globally in main.ts via app.use().
 * Never use console.log — always use NestJS Logger (per AGENTS.md).
 */
@Injectable()
export class LatencyLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    responseTime((request: Request, response: Response, time: number) => {
      const { method, originalUrl } = request;
      const { statusCode } = response;
      const latencyMs = parseFloat(time.toFixed(2));
      const payload = {
        event: 'HTTP_RESPONSE',
        method,
        url: originalUrl,
        status: statusCode,
        latencyMs,
      };

      if (statusCode >= 500) {
        this.logger.error(payload);
      } else if (statusCode >= 400) {
        this.logger.warn(payload);
      } else {
        this.logger.log(payload);
      }
    })(req, res, next);
  }
}
