import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import {
  IS_OPTIONAL_AUTH,
  IS_PUBLIC_ROUTE,
} from '../common/auth/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      if (isOptionalAuth) {
        return true;
      }
      throw new UnauthorizedException('Missing or invalid access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);

      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
      };

      request.user = user;
      return true;
    } catch {
      if (isOptionalAuth) {
        return true;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
