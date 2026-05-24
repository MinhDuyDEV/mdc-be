const EXPIRES_IN_PATTERN = /^(\d+)([smhd])$/;

export function parseExpiresInToMs(expiresIn: string): number {
  const match = expiresIn.match(EXPIRES_IN_PATTERN);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  return value * 24 * 60 * 60 * 1000;
}

export function parseExpiresInToDate(expiresIn: string): Date {
  return new Date(Date.now() + parseExpiresInToMs(expiresIn));
}
