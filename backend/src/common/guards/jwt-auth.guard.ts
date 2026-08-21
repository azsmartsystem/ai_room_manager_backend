import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvalidTokenException } from '../exceptions/auth/invalid-token.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      if (info instanceof Error) {
        throw new InvalidTokenException(info.message);
      }
      throw new InvalidTokenException();
    }
    return user;
  }
}
