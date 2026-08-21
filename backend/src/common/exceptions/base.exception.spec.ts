import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from './base.exception';

describe('RoomManagerException', () => {
  it('should initialize with code, default detail, and empty context when omitted', () => {
    const ex = new RoomManagerException({ code: 'TEST_CODE' }, HttpStatus.BAD_REQUEST);

    expect(ex.code).toBe('TEST_CODE');
    expect(ex.message).toBe('TEST_CODE');
    expect(ex.context).toEqual({});
    expect(ex.getStatus()).toBe(400);
  });

  it('should initialize with custom detail and custom context', () => {
    const ex = new RoomManagerException(
      { code: 'TEST_CODE', detail: 'Specific detail', context: { foo: 'bar' } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

    expect(ex.code).toBe('TEST_CODE');
    expect(ex.message).toBe('Specific detail');
    expect(ex.context).toEqual({ foo: 'bar' });
    expect(ex.getStatus()).toBe(422);
  });
});
