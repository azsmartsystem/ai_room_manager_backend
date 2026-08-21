import { JwtAuthGuard } from './jwt-auth.guard';
import { InvalidTokenException } from '../exceptions/auth/invalid-token.exception';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should call canActivate on parent AuthGuard', () => {
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;

    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true as boolean);
    const result = guard.canActivate(mockCtx);
    expect(result).toBe(true);
    superSpy.mockRestore();
  });

  it('should return user when authentication succeeds', () => {
    const mockUser = { id: 'u1', email: 'test@hotel.com' };
    const result = guard.handleRequest(null, mockUser, null);
    expect(result).toBe(mockUser);
  });

  it('should throw InvalidTokenException when error occurs or user is missing', () => {
    expect(() => guard.handleRequest(new Error('err'), null, null)).toThrow(InvalidTokenException);
    expect(() => guard.handleRequest(null, null, new Error('jwt expired'))).toThrow(
      InvalidTokenException,
    );
  });
});
