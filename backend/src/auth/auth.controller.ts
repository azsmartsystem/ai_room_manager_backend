import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, AuthContext } from './auth.service';
import { LoginDto, LoginDtoSchema } from './dto/login.dto';
import { RefreshTokenDto, RefreshTokenDtoSchema } from './dto/refresh-token.dto';
import {
  RequestPasswordResetDto,
  RequestPasswordResetDtoSchema,
} from './dto/request-password-reset.dto';
import { ResetPasswordDto, ResetPasswordDtoSchema } from './dto/reset-password.dto';
import { TypeBoxValidationPipe } from '../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

import { CreateUserDto, CreateUserDtoSchema } from '../users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractContext(req: Request): AuthContext {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return { ipAddress, userAgent };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user account',
    description: 'Creates a user account and returns JWT access + refresh tokens.',
  })
  async register(
    @Body(new TypeBoxValidationPipe(CreateUserDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.register(dto as CreateUserDto, this.extractContext(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates a user and returns a JWT access token, refresh token, and user profile. ' +
      'The access token expires in 15 minutes by default. Use the refresh token to obtain a new access token without re-authenticating.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'admin@hotel.com',
          description: 'Registered email address',
        },
        password: {
          type: 'string',
          minLength: 1,
          example: 'securePassword123',
          description: 'Account password',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT access token (expires in 15m)' },
        refreshToken: { type: 'string', description: 'JWT refresh token (expires in 7d)' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: {
              type: 'string',
              enum: [
                'SUPER_ADMIN',
                'PROPERTY_MANAGER',
                'FRONT_DESK',
                'HOUSEKEEPING',
                'MAINTENANCE',
                'SECURITY',
              ],
            },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
            propertyId: { type: 'string', nullable: true },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 422, description: 'Validation failed — malformed request body' })
  async login(
    @Body(new TypeBoxValidationPipe(LoginDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.login(dto as LoginDto, this.extractContext(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token for a new access token and refresh token pair. ' +
      'The old refresh token is invalidated (rotation). Returns 401 if the refresh token is expired or already used.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Valid refresh token from login or previous refresh',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token expired or invalid' })
  async refresh(
    @Body(new TypeBoxValidationPipe(RefreshTokenDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.refreshToken(dto as RefreshTokenDto, this.extractContext(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout and invalidate refresh token',
    description:
      'Ends the current session by invalidating the provided refresh token. ' +
      'The access token remains valid until it expires. Pass the refresh token in the body to invalidate a specific session.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Refresh token to invalidate (optional — invalidates all if omitted)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    return this.authService.logout(userId, body?.refreshToken, this.extractContext(req));
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      "Generates a time-limited password reset token and sends it to the user's email. " +
      'Always returns 200 to prevent email enumeration. The token expires in 1 hour.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'admin@hotel.com',
          description: 'Email of the account to reset',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'If the email exists, a reset link has been sent' })
  @ApiResponse({ status: 422, description: 'Validation failed — invalid email format' })
  async requestPasswordReset(
    @Body(new TypeBoxValidationPipe(RequestPasswordResetDtoSchema))
    dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.requestPasswordReset(
      dto as RequestPasswordResetDto,
      this.extractContext(req),
    );
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Consumes the password reset token (from email) and sets a new password. ' +
      'The token is single-use and expires after 1 hour. All existing refresh tokens for the user are revoked.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'newPassword'],
      properties: {
        token: { type: 'string', description: 'Password reset token from email' },
        newPassword: {
          type: 'string',
          minLength: 8,
          example: 'NewSecurePass123',
          description: 'New password (minimum 8 characters)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Token expired or invalid' })
  async resetPassword(
    @Body(new TypeBoxValidationPipe(ResetPasswordDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.resetPassword(dto as ResetPasswordDto, this.extractContext(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt-access')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      "Returns the authenticated user's profile. Use this to verify the token is valid and to " +
      "retrieve the user's role, property assignment, and last login timestamp.",
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: {
              type: 'string',
              enum: [
                'SUPER_ADMIN',
                'PROPERTY_MANAGER',
                'FRONT_DESK',
                'HOUSEKEEPING',
                'MAINTENANCE',
                'SECURITY',
              ],
            },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
            propertyId: { type: 'string', nullable: true },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
