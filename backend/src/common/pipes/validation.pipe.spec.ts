import { BadRequestException } from '@nestjs/common';
import { TypeBoxValidationPipe } from './validation.pipe';
import { Type } from '@sinclair/typebox';

describe('TypeBoxValidationPipe', () => {
  const Schema = Type.Object({
    email: Type.String({ format: 'email' }),
    count: Type.Number({ minimum: 1 }),
    createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  });

  it('should pass valid data with date-time and cast it correctly', () => {
    const pipe = new TypeBoxValidationPipe(Schema);
    const valid = {
      email: 'test@example.com',
      count: 5,
      createdAt: '2026-08-21T12:00:00Z',
    };

    const result = pipe.transform(valid);
    expect(result).toEqual(valid);
  });

  it('should throw BadRequestException for invalid email or date-time', () => {
    const pipe = new TypeBoxValidationPipe(Schema);
    const invalid = { email: 'not-an-email', count: 0, createdAt: 'not-a-date' };

    expect(() => pipe.transform(invalid)).toThrow(BadRequestException);
  });

  it('should pass value through if no schema is provided', () => {
    const pipe = new TypeBoxValidationPipe();
    expect(pipe.transform('any-val')).toBe('any-val');
  });
});
