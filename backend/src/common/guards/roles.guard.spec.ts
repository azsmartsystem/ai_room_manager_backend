import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@prisma/client';
import { InsufficientRoleException } from '../exceptions/auth/insufficient-role.exception';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockExecutionContext(user?: { role?: Role; id?: string }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no roles are required on handler or class', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockExecutionContext({ role: Role.FRONT_DESK });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user possesses the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.SUPER_ADMIN, Role.PROPERTY_MANAGER]);
    const context = createMockExecutionContext({ role: Role.SUPER_ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw InsufficientRoleException when user lacks the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPER_ADMIN]);
    const context = createMockExecutionContext({ role: Role.HOUSEKEEPING });

    expect(() => guard.canActivate(context)).toThrow(InsufficientRoleException);
  });

  it('should throw InsufficientRoleException when user is not present on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPER_ADMIN]);
    const context = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(InsufficientRoleException);
  });
});
