import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { EmailVerifiedGuard } from './email-verified.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(user: { id: string } | undefined): ExecutionContext {
  const handler = jest.fn();
  const cls = jest.fn();

  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    // Construct directly — no need for a full NestJS testing module.
    guard = new EmailVerifiedGuard(
      reflector,
      prisma as unknown as import('../../infra/prisma/prisma.service').PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Case 1: No @VerifiedEmail() metadata — guard is a no-op
  // -------------------------------------------------------------------------
  it('returns true when @VerifiedEmail() metadata is absent', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const ctx = buildContext({ id: 'user-1' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 2: Metadata present + user has emailVerifiedAt set → allow
  // -------------------------------------------------------------------------
  it('returns true when user email is verified', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: new Date('2025-01-01T00:00:00Z'),
    });

    const ctx = buildContext({ id: 'user-1' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, emailVerifiedAt: true },
    });
  });

  // -------------------------------------------------------------------------
  // Case 3: Metadata present + emailVerifiedAt is null → 403
  // -------------------------------------------------------------------------
  it('throws ForbiddenException(EMAIL_NOT_VERIFIED) when emailVerifiedAt is null', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: null,
    });

    const ctx = buildContext({ id: 'user-1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('EMAIL_NOT_VERIFIED'),
    );
  });

  // -------------------------------------------------------------------------
  // Case 3b: Metadata present + user record not found → 403
  // -------------------------------------------------------------------------
  it('throws ForbiddenException(EMAIL_NOT_VERIFIED) when user record is not found', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    prisma.user.findUnique.mockResolvedValue(null);

    const ctx = buildContext({ id: 'ghost-user' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('EMAIL_NOT_VERIFIED'),
    );
  });

  // -------------------------------------------------------------------------
  // Case 4: Metadata present + no request user → 403
  // -------------------------------------------------------------------------
  it('throws ForbiddenException(Authentication required) when request has no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const ctx = buildContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('Authentication required'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
