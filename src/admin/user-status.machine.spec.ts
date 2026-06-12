import { BadRequestException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import {
  assertValidUserStatusTransition,
  isAllowedUserStatusTransition,
} from './user-status.machine';

describe('user-status.machine', () => {
  describe('isAllowedUserStatusTransition', () => {
    it.each([
      [UserStatus.ACTIVE, UserStatus.SUSPENDED],
      [UserStatus.ACTIVE, UserStatus.DISABLED],
      [UserStatus.ACTIVE, UserStatus.DELETED],
      [UserStatus.SUSPENDED, UserStatus.ACTIVE],
      [UserStatus.SUSPENDED, UserStatus.DISABLED],
      [UserStatus.SUSPENDED, UserStatus.DELETED],
      [UserStatus.DISABLED, UserStatus.ACTIVE],
      [UserStatus.DISABLED, UserStatus.SUSPENDED],
      [UserStatus.DISABLED, UserStatus.DELETED],
    ])('allows %s → %s', (from, to) => {
      expect(isAllowedUserStatusTransition(from, to)).toBe(true);
    });

    it.each([
      [UserStatus.DELETED, UserStatus.ACTIVE],
      [UserStatus.DELETED, UserStatus.SUSPENDED],
      [UserStatus.DELETED, UserStatus.DISABLED],
      [UserStatus.SUSPENDED, UserStatus.SUSPENDED], // self-loop
      [UserStatus.DISABLED, UserStatus.DISABLED], // self-loop
      [UserStatus.ACTIVE, UserStatus.ACTIVE], // self-loop
    ])('rejects %s → %s', (from, to) => {
      expect(isAllowedUserStatusTransition(from, to)).toBe(false);
    });
  });

  describe('assertValidUserStatusTransition', () => {
    it.each([
      [UserStatus.ACTIVE, UserStatus.SUSPENDED],
      [UserStatus.ACTIVE, UserStatus.DISABLED],
      [UserStatus.ACTIVE, UserStatus.DELETED],
      [UserStatus.SUSPENDED, UserStatus.ACTIVE],
      [UserStatus.SUSPENDED, UserStatus.DISABLED],
      [UserStatus.SUSPENDED, UserStatus.DELETED],
      [UserStatus.DISABLED, UserStatus.ACTIVE],
      [UserStatus.DISABLED, UserStatus.SUSPENDED],
      [UserStatus.DISABLED, UserStatus.DELETED],
    ])('does not throw for allowed %s → %s', (from, to) => {
      expect(() => assertValidUserStatusTransition(from, to)).not.toThrow();
    });

    it.each([
      [UserStatus.DELETED, UserStatus.ACTIVE],
      [UserStatus.DELETED, UserStatus.SUSPENDED],
      [UserStatus.DELETED, UserStatus.DISABLED],
    ])('throws BadRequestException for %s → %s', (from, to) => {
      expect(() => assertValidUserStatusTransition(from, to)).toThrow(
        BadRequestException,
      );
    });

    it('throws with descriptive message including both statuses', () => {
      expect(() =>
        assertValidUserStatusTransition(UserStatus.DELETED, UserStatus.ACTIVE),
      ).toThrow(/DELETED.*ACTIVE/);
    });
  });
});
