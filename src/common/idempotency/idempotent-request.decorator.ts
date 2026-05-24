import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_REQUEST_METADATA = Symbol(
  'IDEMPOTENT_REQUEST_METADATA',
);

export interface IdempotentRequestMetadata {
  scope: string;
}

export function IdempotentRequest(scope: string) {
  return SetMetadata(IDEMPOTENT_REQUEST_METADATA, { scope });
}
