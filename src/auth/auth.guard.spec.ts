import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as any;
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new AuthGuard(jwtService, reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('public routes', () => {
    it('should allow access when route is marked @Public()', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn(),
        }),
      } as any;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('protected routes', () => {
    const mockContext = () => {
      const request = { headers: {} };
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(request),
        }),
      } as any;
    };

    it('should throw UnauthorizedException when no token provided', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should populate request.user on valid token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockContext();
      const request = context.switchToHttp().getRequest();
      request.headers.authorization = 'Bearer valid.jwt.token';

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(request.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockContext();
      const request = context.switchToHttp().getRequest();
      request.headers.authorization = 'Bearer invalid.token';

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Invalid'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
