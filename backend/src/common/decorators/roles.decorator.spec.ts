import { Roles, ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';

describe('Roles Decorator', () => {
  it('should set roles metadata', () => {
    class Target {
      @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
      handler() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, Target.prototype.handler);
    expect(metadata).toEqual([Role.SUPER_ADMIN, Role.PROPERTY_MANAGER]);
  });
});
