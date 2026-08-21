import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { AppConfigService } from '../../config/config.service';
import { UsersService } from '../../users/users.service';
import { InvalidTokenException } from '../../common/exceptions/auth/invalid-token.exception';
import { Role, UserStatus } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  beforeEach(async () => {
    usersService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AppConfigService,
          useValue: { jwtAccessSecret: 'super-secret-32-chars-long-secret!' },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return safe user when active', async () => {
    const mockUser = {
      id: 'u1',
      email: 'admin@hotel.com',
      passwordHash: 'hashed_pwd',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      propertyId: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService.findById.mockResolvedValue(mockUser);

    const payload: JwtPayload = { sub: 'u1', email: 'admin@hotel.com', role: 'SUPER_ADMIN' };
    const result = await strategy.validate(payload);

    expect(usersService.findById).toHaveBeenCalledWith('u1');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.id).toBe('u1');
  });

  it('should throw InvalidTokenException when user is inactive or not found', async () => {
    usersService.findById.mockResolvedValue(null);

    const payload: JwtPayload = { sub: 'u1', email: 'admin@hotel.com', role: 'SUPER_ADMIN' };
    await expect(strategy.validate(payload)).rejects.toThrow(InvalidTokenException);
  });
});
