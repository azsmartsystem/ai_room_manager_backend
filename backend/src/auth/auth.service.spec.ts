import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { Role, UserStatus } from '@prisma/client';
import { InvalidCredentialsException } from '../common/exceptions/auth/invalid-credentials.exception';
import { InvalidTokenException } from '../common/exceptions/auth/invalid-token.exception';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_secret_val'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
    updateLastLogin: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };
  let configService: {
    jwtAccessSecret: string;
    jwtAccessExpiresIn: string;
  };
  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateLastLogin: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_access_token'),
    };

    configService = {
      jwtAccessSecret: 'super-secret-key-32-chars-length!!',
      jwtAccessExpiresIn: '15m',
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: AppConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return tokens and user', async () => {
      const mockCreated = {
        id: 'u-reg',
        email: 'newuser@hotel.com',
        role: Role.FRONT_DESK,
        propertyId: 'prop-1',
        status: UserStatus.ACTIVE,
      };
      usersService.create = jest.fn().mockResolvedValue(mockCreated);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.register({
        email: 'newuser@hotel.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        role: 'FRONT_DESK',
        propertyId: 'prop-1',
      });

      expect(usersService.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.user.id).toBe('u-reg');
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      email: 'admin@hotel.com',
      passwordHash: 'hashed_password_in_db',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      propertyId: 'prop-1',
    };

    it('should authenticate user and return tokens and user info', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login(
        { email: 'admin@hotel.com', password: 'ValidPassword123' },
        { ipAddress: '127.0.0.1', userAgent: 'Jest' },
      );

      expect(usersService.findByEmail).toHaveBeenCalledWith('admin@hotel.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('ValidPassword123', 'hashed_password_in_db');
      expect(jwtService.sign).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_LOGIN', actorId: 'user-1' }),
      );
      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'admin@hotel.com',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        propertyId: 'prop-1',
      });
    });

    it('should throw InvalidCredentialsException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nonexistent@hotel.com', password: 'password' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should throw InvalidCredentialsException when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.login({ email: 'admin@hotel.com', password: 'password' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should throw InvalidCredentialsException when password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'admin@hotel.com', password: 'WrongPassword' }),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token and issue new access token', async () => {
      const activeUser = {
        id: 'user-1',
        email: 'admin@hotel.com',
        role: Role.SUPER_ADMIN,
        propertyId: 'prop-1',
        status: UserStatus.ACTIVE,
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        tokenHash: 'somehash',
        isRevoked: false,
        expiresAt: futureDate,
        user: activeUser,
      });

      prisma.refreshToken.update.mockResolvedValue({ id: 'rt-old', isRevoked: true });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-new' });

      const result = await service.refreshToken({ refreshToken: 'valid-refresh-token-string' });

      expect(prisma.refreshToken.findUnique).toHaveBeenCalled();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-old' },
        data: { isRevoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw InvalidTokenException when refresh token user is inactive', async () => {
      const inactiveUser = {
        id: 'user-1',
        email: 'admin@hotel.com',
        role: Role.SUPER_ADMIN,
        propertyId: 'prop-1',
        status: UserStatus.SUSPENDED,
      };

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        tokenHash: 'somehash',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 10000),
        user: inactiveUser,
      });
      prisma.refreshToken.update.mockResolvedValue({ id: 'rt-old' });

      await expect(service.refreshToken({ refreshToken: 'some-token' })).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should throw InvalidTokenException when refresh token is revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-revoked',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 10000),
      });

      await expect(service.refreshToken({ refreshToken: 'revoked-token' })).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should throw InvalidTokenException when refresh token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-expired',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 10000), // past
      });

      await expect(service.refreshToken({ refreshToken: 'expired-token' })).rejects.toThrow(
        InvalidTokenException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and dispatch audit log', async () => {
      usersService.findById.mockResolvedValue({
        id: 'u-1',
        email: 'user@hotel.com',
        role: Role.FRONT_DESK,
      });

      const result = await service.logout('u-1', 'active-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_LOGOUT', actorId: 'u-1' }),
      );
      expect(result.success).toBe(true);
    });

    it('should logout cleanly when refresh token is omitted', async () => {
      usersService.findById.mockResolvedValue({
        id: 'u-1',
        email: 'user@hotel.com',
        role: Role.FRONT_DESK,
      });

      const result = await service.logout('u-1');

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing active user', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@hotel.com',
        role: Role.FRONT_DESK,
        status: UserStatus.ACTIVE,
      });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt-1' });

      const result = await service.requestPasswordReset({ email: 'user@hotel.com' });

      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_RESET_REQUESTED' }),
      );
      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
    });

    it('should return generic success message when user not found to prevent user enumeration', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'unknown@hotel.com' });

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.resetToken).toBeUndefined();
    });

    it('should return generic success when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'inactive@hotel.com',
        status: UserStatus.INACTIVE,
      });

      const result = await service.requestPasswordReset({ email: 'inactive@hotel.com' });

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should update user password and revoke all active refresh tokens', async () => {
      const resetRecord = {
        id: 'prt-1',
        isUsed: false,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour ahead
        user: {
          id: 'user-1',
          email: 'user@hotel.com',
          role: Role.MAINTENANCE,
        },
      };
      prisma.passwordResetToken.findUnique.mockResolvedValue(resetRecord);
      prisma.passwordResetToken.update.mockResolvedValue({ ...resetRecord, isUsed: true });
      usersService.updatePassword.mockResolvedValue(undefined);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword({
        token: 'valid-reset-token-plain',
        newPassword: 'BrandNewPassword123!',
      });

      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-1' },
        data: { isUsed: true },
      });
      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'BrandNewPassword123!');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRevoked: false },
        data: { isRevoked: true },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_RESET_COMPLETED' }),
      );
      expect(result.success).toBe(true);
    });

    it('should throw InvalidTokenException when reset token is expired or used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        isUsed: true, // already used
        expiresAt: new Date(Date.now() + 10000),
      });

      await expect(
        service.resetPassword({
          token: 'already-used-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(InvalidTokenException);
    });
  });
});
