import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import {
  IS_OPTIONAL_AUTH,
  IS_PUBLIC_ROUTE,
} from '../common/auth/public.decorator';
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

  describe('optional auth routes', () => {
    it('should allow access when no token provided', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_ROUTE) return false;
        if (key === IS_OPTIONAL_AUTH) return true;
        return false;
      });

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ headers: {} }),
        }),
      } as any;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should authenticate valid token and attach user', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_ROUTE) return false;
        if (key === IS_OPTIONAL_AUTH) return true;
        return false;
      });

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: { authorization: 'Bearer valid.jwt' },
          }),
        }),
      } as any;

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should allow anonymous access for invalid token on optional auth', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_ROUTE) return false;
        if (key === IS_OPTIONAL_AUTH) return true;
        return false;
      });

      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: { authorization: 'Bearer bad.token' },
          }),
        }),
      } as any;

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Invalid'));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(context.switchToHttp().getRequest().user).toBeUndefined();
    });
  });
});
