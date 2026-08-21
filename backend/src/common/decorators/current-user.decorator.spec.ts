import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser, AuthenticatedUser } from './current-user.decorator';
import { ExecutionContext } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';

function getParamDecoratorFactory(_decorator: (...args: unknown[]) => unknown) {
  class TestController {
    public testMethod(@CurrentUser() _user: unknown, @CurrentUser('id') _id: unknown) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'testMethod');
  const key = Object.keys(args)[0]!;
  return args[key].factory;
}

describe('CurrentUser Decorator', () => {
  const factory = getParamDecoratorFactory(CurrentUser);

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    email: 'admin@hotel.com',
    firstName: 'Admin',
    lastName: 'User',
    role: Role.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    propertyId: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createMockCtx(user?: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should return null when no user is attached to the request', () => {
    const result = factory(undefined, createMockCtx(undefined));
    expect(result).toBeNull();
  });

  it('should return the entire user object when no data key is provided', () => {
    const result = factory(undefined, createMockCtx(mockUser));
    expect(result).toEqual(mockUser);
  });

  it('should return the specific property when data key is provided', () => {
    const result = factory('email', createMockCtx(mockUser));
    expect(result).toBe('admin@hotel.com');
  });
});
