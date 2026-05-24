import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const E2E_TESTCONTAINERS_FLAG = 'MDC_E2E_TESTCONTAINERS';

const workspaceKey = process.cwd().replace(/[^a-zA-Z0-9_-]/g, '_');

export const e2eTestcontainersStatePath = join(
  tmpdir(),
  `mdc-be-e2e-testcontainers-${workspaceKey}.json`,
);

export interface E2eTestcontainersState {
  containerIds: string[];
}

export function shouldUseE2eTestcontainers(): boolean {
  const value = process.env[E2E_TESTCONTAINERS_FLAG]?.toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isE2eTestcontainersState(
  value: unknown,
): value is E2eTestcontainersState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { containerIds?: unknown };
  return (
    Array.isArray(candidate.containerIds) &&
    candidate.containerIds.every((id) => typeof id === 'string')
  );
}
