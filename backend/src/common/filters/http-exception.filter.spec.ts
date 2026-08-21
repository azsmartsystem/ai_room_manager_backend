import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';
import { RoomManagerException } from '../exceptions/base.exception';
import { Request, Response } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string; method: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/api/v1/test', method: 'POST' };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as unknown as Response,
        getRequest: () => mockRequest as unknown as Request,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle RoomManagerException correctly', () => {
    const exception = new RoomManagerException(
      { code: 'CUSTOM_ERR', detail: 'Custom error detail', context: { key: 'val' } },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'CUSTOM_ERR',
        message: 'Custom error detail',
        context: { key: 'val' },
        path: '/api/v1/test',
      }),
    );
  });

  it('should handle standard HttpException with object payload and validation errors', () => {
    const exception = new HttpException(
      {
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        errors: [{ path: '/email', message: 'invalid email' }],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        context: { errors: [{ path: '/email', message: 'invalid email' }] },
      }),
    );
  });

  it('should handle standard HttpException with string message', () => {
    const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Forbidden resource',
      }),
    );
  });

  it('should handle unexpected Error correctly as 500', () => {
    const exception = new Error('Unexpected crash');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });
});
