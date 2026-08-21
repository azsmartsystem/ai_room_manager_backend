import { LatencyLoggerMiddleware } from './latency-logger.middleware';
import { Request, Response, NextFunction } from 'express';

jest.mock('response-time', () => {
  return jest.fn((callback: (req: Request, res: Response, time: number) => void) => {
    return (req: Request, res: Response, next: NextFunction) => {
      callback(req, res, 12.34);
      next();
    };
  });
});

describe('LatencyLoggerMiddleware', () => {
  let middleware: LatencyLoggerMiddleware;

  beforeEach(() => {
    middleware = new LatencyLoggerMiddleware();
  });

  it('should call next function and record latency for 200 response', () => {
    const req = { method: 'GET', originalUrl: '/api/v1/auth/me' } as unknown as Request;
    const res = { statusCode: 200 } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should handle 400 client error responses', () => {
    const req = { method: 'POST', originalUrl: '/api/v1/auth/login' } as unknown as Request;
    const res = { statusCode: 400 } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should handle 500 server error responses', () => {
    const req = { method: 'POST', originalUrl: '/api/v1/auth/login' } as unknown as Request;
    const res = { statusCode: 500 } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
