/**
 * Outbox domain constants.
 * Shared defaults, tokens, and well-known values for the outbox subsystem.
 */
export const OUTBOX_DEFAULTS = {
  /** Maximum number of events claimed per poll cycle */
  BATCH_SIZE: 20,
  /** Maximum retry attempts before moving to dead-letter */
  MAX_RETRIES: 5,
  /** Base backoff in milliseconds for exponential backoff */
  BASE_BACKOFF_MS: 1000,
  /** Maximum backoff cap in milliseconds */
  MAX_BACKOFF_MS: 60000,
  /** Lease timeout in milliseconds before stale lock recovery */
  LEASE_TIMEOUT_MS: 60000,
  /** Maximum pending events before health check reports degraded */
  HEALTH_LAG_THRESHOLD: 100,
} as const;
