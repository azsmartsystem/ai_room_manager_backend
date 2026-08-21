import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RoomManagerException } from '../exceptions/base.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let context: Record<string, unknown> = {};

    if (exception instanceof RoomManagerException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      context = exception.context;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        code = (resObj['code'] as string) ?? (resObj['error'] as string) ?? 'HTTP_EXCEPTION';
        message = (resObj['message'] as string) ?? exception.message;
        if (resObj['errors']) {
          context = { errors: resObj['errors'] };
        }
      } else {
        message = String(res);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error({
        event: 'UNHANDLED_EXCEPTION',
        error: exception.message,
        stack: exception.stack,
        path: request.url,
        method: request.method,
      });
    }

    if (status >= 500) {
      this.logger.error({
        event: 'HTTP_ERROR_RESPONSE',
        status,
        code,
        message,
        path: request.url,
        method: request.method,
      });
    } else if (status >= 400) {
      this.logger.warn({
        event: 'HTTP_CLIENT_ERROR',
        status,
        code,
        message,
        path: request.url,
        method: request.method,
      });
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      context: Object.keys(context).length > 0 ? context : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
