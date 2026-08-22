import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InvalidCredentialsException } from '../common/exceptions/auth/invalid-credentials.exception';
import { InvalidTokenException } from '../common/exceptions/auth/invalid-token.exception';
import { UserStatus } from '@prisma/client';

export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateSecureRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async register(
    dto: import('../users/dto/create-user.dto').CreateUserDto,
    context: AuthContext = {},
  ) {
    const user = await this.usersService.create(dto);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });

    const rawRefreshToken = this.generateSecureRandomToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: refreshExpiry,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      resource: 'AUTH',
      resourceId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: safeUser,
    };
  }

  async login(dto: LoginDto, context: AuthContext = {}) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      this.logger.warn({
        event: 'LOGIN_FAILED',
        email: dto.email,
        reason: !user ? 'USER_NOT_FOUND' : 'USER_INACTIVE',
        ipAddress: context.ipAddress,
      });
      throw new InvalidCredentialsException();
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      this.logger.warn({
        event: 'LOGIN_FAILED',
        email: dto.email,
        reason: 'PASSWORD_MISMATCH',
        ipAddress: context.ipAddress,
      });
      throw new InvalidCredentialsException();
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });

    const rawRefreshToken = this.generateSecureRandomToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: refreshExpiry,
      },
    });

    await this.usersService.updateLastLogin(user.id);

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resource: 'AUTH',
      resourceId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: safeUser,
    };
  }

  async refreshToken(dto: RefreshTokenDto, context: AuthContext = {}) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      this.logger.warn({
        event: 'REFRESH_TOKEN_REJECTED',
        reason: !storedToken ? 'NOT_FOUND' : storedToken.isRevoked ? 'REVOKED' : 'EXPIRED',
        ipAddress: context.ipAddress,
      });
      throw new InvalidTokenException('Refresh token is invalid or expired');
    }

    // Revoke previous token (Rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const user = storedToken.user;
    if (user.status !== UserStatus.ACTIVE) {
      throw new InvalidTokenException('User account is inactive');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });

    const newRawRefreshToken = this.generateSecureRandomToken();
    const newTokenHash = this.hashToken(newRawRefreshToken);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: refreshExpiry,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'TOKEN_REFRESHED',
      resource: 'AUTH',
      resourceId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string, context: AuthContext = {}) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { isRevoked: true },
      });
    }

    const user = await this.usersService.findById(userId).catch(() => null);

    await this.auditService.log({
      actorId: userId,
      actorEmail: user?.email,
      actorRole: user?.role,
      action: 'USER_LOGOUT',
      resource: 'AUTH',
      resourceId: userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto, context: AuthContext = {}) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user && user.status === UserStatus.ACTIVE) {
      const rawToken = this.generateSecureRandomToken();
      const tokenHash = this.hashToken(rawToken);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour validity

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await this.auditService.log({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'AUTH',
        resourceId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        success: true,
        message: 'If an account with that email exists, a password reset token has been generated.',
        resetToken: rawToken,
      };
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset token has been generated.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, context: AuthContext = {}) {
    const tokenHash = this.hashToken(dto.token);

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.isUsed || resetRecord.expiresAt < new Date()) {
      throw new InvalidTokenException('Password reset token is invalid or has expired');
    }

    const user = resetRecord.user;

    // Mark reset token used
    await this.prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { isUsed: true },
    });

    // Update password
    await this.usersService.updatePassword(user.id, dto.newPassword);

    // Invalidate all active refresh sessions for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'AUTH',
      resourceId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      success: true,
      message: 'Password has been successfully reset. Please log in with your new password.',
    };
  }
}
