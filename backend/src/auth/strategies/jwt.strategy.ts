import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/config.service';
import { UsersService } from '../../users/users.service';
import { InvalidTokenException } from '../../common/exceptions/auth/invalid-token.exception';
import { UserStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  propertyId?: string | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new InvalidTokenException('User account is not active or does not exist');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
