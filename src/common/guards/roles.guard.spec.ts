import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { PERMISSIONS_METADATA_KEY } from '../decorators/permissions.decorator';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let prisma: { adminUser: { findUnique: jest.Mock } };
  let reflector: Reflector;

  beforeEach(() => {
    prisma = { adminUser: { findUnique: jest.fn() } };
    reflector = new Reflector();
    guard = new RolesGuard(reflector, prisma as unknown as PrismaService);
  });

  const mockContext = (
    user: any,
    roles?: string[],
    permissions?: string[],
  ): ExecutionContext => {
    const req = { user };
    const handler = jest.fn();
    const spy = jest.spyOn(reflector, 'getAllAndOverride');
    if (roles || permissions) {
      spy.mockImplementation((key) => {
        if (key === ROLES_METADATA_KEY) return roles ?? undefined;
        if (key === PERMISSIONS_METADATA_KEY) return permissions ?? undefined;
        return undefined;
      });
    } else {
      spy.mockReturnValue(undefined);
    }
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => ({}),
    } as any;
  };

  it('allows access when no roles required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = mockContext({ id: 'user-1' });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user not authenticated', async () => {
    const ctx = mockContext(null, ['admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows admin when AdminUser exists with ADMIN role', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.ADMIN,
      permissions: [],
    });
    const ctx = mockContext({ id: 'admin-1' }, ['admin']);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows super_admin when AdminUser exists with SUPER_ADMIN role', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.SUPER_ADMIN,
      permissions: [],
    });
    const ctx = mockContext({ id: 'super-1' }, ['super_admin']);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows moderator when AdminUser exists with MODERATOR role', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.MODERATOR,
      permissions: [],
    });
    const ctx = mockContext({ id: 'mod-1' }, ['moderator']);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when AdminUser not found', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    const ctx = mockContext({ id: 'user-1' }, ['admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when role insufficient', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.MODERATOR,
      permissions: [],
    });
    const ctx = mockContext({ id: 'mod-1' }, ['super_admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows admin with matching permission', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.ADMIN,
      permissions: [{ permission: 'MANAGE_USERS' }],
    });
    const ctx = mockContext({ id: 'admin-1' }, ['admin'], ['MANAGE_USERS']);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('denies admin without required permission', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.ADMIN,
      permissions: [{ permission: 'MODERATE_CONTENT' }],
    });
    const ctx = mockContext({ id: 'admin-1' }, ['admin'], ['MANAGE_USERS']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows super_admin without specific permission', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      role: AdminRole.SUPER_ADMIN,
      permissions: [],
    });
    const ctx = mockContext({ id: 'super-1' }, ['admin'], ['MANAGE_USERS']);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('denies non-admin user with permission requirement', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    const ctx = mockContext({ id: 'user-1' }, ['admin'], ['MANAGE_USERS']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
