import { BadRequestException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";

/**
 * Allowed user-status transitions.
 *
 * Rules:
 *   - DELETED is terminal: no transitions out of it.
 *   - Any non-DELETED status can transition to DELETED.
 *   - ACTIVE ⇄ SUSPENDED (suspend / lift suspension).
 *   - ACTIVE → DISABLED (administrative disable).
 *   - SUSPENDED → DISABLED (disable from suspended state).
 *   - DISABLED → ACTIVE (re-enable a disabled account).
 *
 * Same-status is a no-op (callers short-circuit before calling the assertion).
 * Any other transition is rejected with BadRequestException.
 */
const ALLOWED_TRANSITIONS: Record<UserStatus, ReadonlySet<UserStatus>> = {
  [UserStatus.ACTIVE]: new Set<UserStatus>([
    UserStatus.SUSPENDED,
    UserStatus.DISABLED,
    UserStatus.DELETED,
  ]),
  [UserStatus.SUSPENDED]: new Set<UserStatus>([
    UserStatus.ACTIVE,
    UserStatus.DISABLED,
    UserStatus.DELETED,
  ]),
  [UserStatus.DISABLED]: new Set<UserStatus>([UserStatus.ACTIVE, UserStatus.DELETED]),
  [UserStatus.DELETED]: new Set<UserStatus>(),
};

export function isAllowedUserStatusTransition(from: UserStatus, to: UserStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertValidUserStatusTransition(from: UserStatus, to: UserStatus): void {
  if (!isAllowedUserStatusTransition(from, to)) {
    throw new BadRequestException(`Invalid user status transition: ${from} → ${to}`);
  }
}
