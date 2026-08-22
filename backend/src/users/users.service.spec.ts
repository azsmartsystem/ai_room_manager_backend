import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role, UserStatus } from '@prisma/client';
import { UserAlreadyExistsException } from '../common/exceptions/operations/user-already-exists.exception';
import { UserNotFoundException } from '../common/exceptions/operations/user-not-found.exception';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password_123'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const mockCreated = {
        id: 'user-uuid-1',
        email: 'manager@hotel.com',
        passwordHash: 'hashed_password_123',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.PROPERTY_MANAGER,
        status: UserStatus.ACTIVE,
        propertyId: 'prop-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(mockCreated);

      const result = await service.create({
        email: 'manager@hotel.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'PROPERTY_MANAGER',
        propertyId: 'prop-1',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'manager@hotel.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(result).toEqual(mockCreated);
    });

    it('should throw UserAlreadyExistsException if email already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user-id' });

      await expect(
        service.create({
          email: 'duplicate@hotel.com',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'HOUSEKEEPING',
        }),
      ).rejects.toThrow(UserAlreadyExistsException);
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 'u-1', email: 'test@hotel.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('TEST@HOTEL.COM');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@hotel.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findUsers', () => {
    it('should list all users without propertyId filter', async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'u-1' }]);
      const result = await service.findUsers();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should list users scoped to propertyId', async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'u-2' }]);
      const result = await service.findUsers('prop-1');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { propertyId: 'prop-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 'u-1', email: 'test@hotel.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('u-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw UserNotFoundException if not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('updatePassword', () => {
    it('should hash new password and update user record', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
      prisma.user.update.mockResolvedValue({ id: 'u-1' });

      await service.updatePassword('u-1', 'NewSecret999!');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecret999!', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { passwordHash: 'hashed_password_123' },
      });
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt field', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u-1' });

      await service.updateLastLogin('u-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', status: UserStatus.ACTIVE });
      prisma.user.update.mockResolvedValue({ id: 'u-1', status: UserStatus.SUSPENDED });

      const result = await service.updateStatus('u-1', UserStatus.SUSPENDED);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { status: UserStatus.SUSPENDED },
      });
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });
  });
});
