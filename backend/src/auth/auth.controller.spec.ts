import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { Role, UserStatus } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
  };

  const mockRequestWithHeader = {
    headers: {
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Jest-Agent',
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  const mockRequestWithoutHeader = {
    headers: {
      'user-agent': 'Jest-Agent',
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should extract ip from x-forwarded-for and delegate to authService.login', async () => {
      const mockResult = {
        accessToken: 'access_tok',
        refreshToken: 'refresh_tok',
        user: { id: 'u1', email: 'test@hotel.com', role: Role.SUPER_ADMIN },
      };
      authService.login.mockResolvedValue(mockResult);

      const result = await controller.login(
        { email: 'test@hotel.com', password: 'password123' },
        mockRequestWithHeader,
      );

      expect(authService.login).toHaveBeenCalledWith(
        { email: 'test@hotel.com', password: 'password123' },
        { ipAddress: '192.168.1.1', userAgent: 'Jest-Agent' },
      );
      expect(result).toEqual(mockResult);
    });

    it('should extract ip from socket.remoteAddress when header missing', async () => {
      authService.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      await controller.login(
        { email: 'test@hotel.com', password: 'password123' },
        mockRequestWithoutHeader,
      );

      expect(authService.login).toHaveBeenCalledWith(
        { email: 'test@hotel.com', password: 'password123' },
        { ipAddress: '127.0.0.1', userAgent: 'Jest-Agent' },
      );
    });
  });

  describe('refresh', () => {
    it('should delegate to authService.refreshToken', async () => {
      const mockResult = { accessToken: 'new_acc', refreshToken: 'new_ref' };
      authService.refreshToken.mockResolvedValue(mockResult);

      const result = await controller.refresh({ refreshToken: 'old_ref' }, mockRequestWithHeader);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        { refreshToken: 'old_ref' },
        { ipAddress: '192.168.1.1', userAgent: 'Jest-Agent' },
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('logout', () => {
    it('should delegate to authService.logout with refreshToken', async () => {
      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(
        'u1',
        { refreshToken: 'ref_tok' },
        mockRequestWithHeader,
      );

      expect(authService.logout).toHaveBeenCalledWith('u1', 'ref_tok', {
        ipAddress: '192.168.1.1',
        userAgent: 'Jest-Agent',
      });
      expect(result).toEqual({ success: true });
    });

    it('should delegate to authService.logout when body is empty', async () => {
      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout('u1', {}, mockRequestWithoutHeader);

      expect(authService.logout).toHaveBeenCalledWith('u1', undefined, {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest-Agent',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('requestPasswordReset', () => {
    it('should delegate to authService.requestPasswordReset', async () => {
      authService.requestPasswordReset.mockResolvedValue({ success: true });

      const result = await controller.requestPasswordReset(
        { email: 'test@hotel.com' },
        mockRequestWithHeader,
      );

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        { email: 'test@hotel.com' },
        { ipAddress: '192.168.1.1', userAgent: 'Jest-Agent' },
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('resetPassword', () => {
    it('should delegate to authService.resetPassword', async () => {
      authService.resetPassword.mockResolvedValue({ success: true });

      const result = await controller.resetPassword(
        { token: 'token123', newPassword: 'NewPassword999!' },
        mockRequestWithHeader,
      );

      expect(authService.resetPassword).toHaveBeenCalledWith(
        { token: 'token123', newPassword: 'NewPassword999!' },
        { ipAddress: '192.168.1.1', userAgent: 'Jest-Agent' },
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getProfile', () => {
    it('should return the authenticated user', () => {
      const mockUser = {
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

      const result = controller.getProfile(mockUser);
      expect(result).toEqual({ user: mockUser });
    });
  });
});
