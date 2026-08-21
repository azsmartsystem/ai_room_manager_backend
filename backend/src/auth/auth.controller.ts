import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractContext(req: Request): AuthContext {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return { ipAddress, userAgent };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new TypeBoxValidationPipe(LoginDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.login(dto as LoginDto, this.extractContext(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new TypeBoxValidationPipe(RefreshTokenDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.refreshToken(dto as RefreshTokenDto, this.extractContext(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    return this.authService.logout(userId, body?.refreshToken, this.extractContext(req));
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
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
  async resetPassword(
    @Body(new TypeBoxValidationPipe(ResetPasswordDtoSchema)) dto: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.resetPassword(dto as ResetPasswordDto, this.extractContext(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
