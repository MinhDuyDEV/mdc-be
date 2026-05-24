import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  e2eTestcontainersStatePath,
  isE2eTestcontainersState,
  shouldUseE2eTestcontainers,
} from './e2e-testcontainers-state';

const execFileAsync = promisify(execFile);

export default async function globalTeardown(): Promise<void> {
  if (!shouldUseE2eTestcontainers()) {
    return;
  }

  try {
    const raw = await readFile(e2eTestcontainersStatePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isE2eTestcontainersState(parsed)) {
      throw new Error('Invalid e2e Testcontainers state file');
    }

    await Promise.allSettled(
      parsed.containerIds.map((id) =>
        execFileAsync('docker', ['rm', '-f', id]),
      ),
    );
  } finally {
    await rm(e2eTestcontainersStatePath, { force: true });
  }
}
