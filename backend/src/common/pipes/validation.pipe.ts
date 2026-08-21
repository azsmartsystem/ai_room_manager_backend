import { PipeTransform, BadRequestException, Injectable, ArgumentMetadata } from '@nestjs/common';
import { TSchema, FormatRegistry } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

if (!FormatRegistry.Has('email')) {
  FormatRegistry.Set('email', (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value: string) => !isNaN(Date.parse(value)));
}

@Injectable()
export class TypeBoxValidationPipe<T extends TSchema> implements PipeTransform {
  constructor(private readonly schema?: T) {}

  transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    const activeSchema = this.schema ?? (metadata?.metatype as unknown as T);
    if (!activeSchema) {
      return value;
    }

    const errors = [...Value.Errors(activeSchema, value)];
    if (errors.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        errors: errors.map((e) => ({ path: e.path, message: e.message })),
      });
    }
    return Value.Cast(activeSchema, value);
  }
}
