import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    create: jest.Mock;
    findUsers: jest.Mock;
    findById: jest.Mock;
    updateStatus: jest.Mock;
  };

  const superAdmin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@hotel.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: Role.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    propertyId: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const manager: AuthenticatedUser = {
    id: 'manager-1',
    email: 'manager@hotel.com',
    firstName: 'Manager',
    lastName: 'User',
    role: Role.PROPERTY_MANAGER,
    status: UserStatus.ACTIVE,
    propertyId: 'prop-1',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findUsers: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should create user as super admin', async () => {
      const mockCreated = {
        id: 'u-1',
        email: 'cleaner@hotel.com',
        firstName: 'Amina',
        lastName: 'Bello',
        role: Role.HOUSEKEEPING,
        status: UserStatus.ACTIVE,
        propertyId: 'prop-1',
        passwordHash: 'hashed',
      };
      service.create.mockResolvedValue(mockCreated);

      const result = await controller.createUser(
        {
          email: 'cleaner@hotel.com',
          password: 'Password123!',
          firstName: 'Amina',
          lastName: 'Bello',
          role: 'HOUSEKEEPING',
          propertyId: 'prop-1',
        },
        superAdmin,
      );

      expect(service.create).toHaveBeenCalled();
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('cleaner@hotel.com');
    });

    it('should enforce propertyId when created by property manager', async () => {
      const mockCreated = {
        id: 'u-2',
        email: 'tech@hotel.com',
        firstName: 'Emeka',
        lastName: 'Nwosu',
        role: Role.MAINTENANCE,
        status: UserStatus.ACTIVE,
        propertyId: 'prop-1',
      };
      service.create.mockResolvedValue(mockCreated);

      await controller.createUser(
        {
          email: 'tech@hotel.com',
          password: 'Password123!',
          firstName: 'Emeka',
          lastName: 'Nwosu',
          role: 'MAINTENANCE',
        },
        manager,
      );

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: 'prop-1' }),
      );
    });
  });

  describe('listUsers', () => {
    it('should list all users for super admin with optional query', async () => {
      service.findUsers.mockResolvedValue([
        { id: 'u-1', email: 'a@hotel.com', passwordHash: 'hash' },
      ]);

      const result = await controller.listUsers(superAdmin, 'prop-1');
      expect(service.findUsers).toHaveBeenCalledWith('prop-1');
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).not.toHaveProperty('passwordHash');
    });

    it('should list scoped users for manager', async () => {
      service.findUsers.mockResolvedValue([]);
      await controller.listUsers(manager);
      expect(service.findUsers).toHaveBeenCalledWith('prop-1');
    });
  });

  describe('getUser', () => {
    it('should retrieve user details without passwordHash', async () => {
      service.findById.mockResolvedValue({
        id: 'u-1',
        email: 'a@hotel.com',
        passwordHash: 'hash',
      });

      const result = await controller.getUser('u-1');
      expect(result.user.id).toBe('u-1');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      service.updateStatus.mockResolvedValue({
        id: 'u-1',
        email: 'a@hotel.com',
        status: UserStatus.SUSPENDED,
      });

      const result = await controller.updateStatus('u-1', { status: UserStatus.SUSPENDED });
      expect(result.user.status).toBe(UserStatus.SUSPENDED);
    });
  });
});
