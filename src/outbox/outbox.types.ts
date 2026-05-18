/**
 * Outbox domain types.
 * Shared interfaces used across the outbox module and its consumers.
 */

export type { DeadLetterEvent } from './dead-letter.service';
export type { ClaimedEvent } from './outbox.processor';
export type { OutboxEventInput } from './outbox.service';
