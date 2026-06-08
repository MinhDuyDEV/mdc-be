// Public emit-side API for the outbox pattern.
// Importers should use this barrel to access OutboxService, OutboxCoreModule,
// IdempotencyService, DeadLetterService, schemas, types, and constants.
//
// NOTE: OutboxProcessorModule and the per-domain event processors
// (`./processors/*`, `./outbox.processor`) are intentionally NOT re-exported
// here. They are implementation details of the worker role and depend on
// RealtimeModule / MessagingModule / ConnectionsModule / RecruitingModule.
// Re-exporting them caused three circular dependency cycles
// (connections, messaging, recruiting -> outbox barrel -> processor ->
// realtime -> messaging -> back to origin). Import the processor module
// directly from './outbox/outbox-processor.module' in app.module.ts.
export * from './dead-letter.service';
export * from './events';
export * from './idempotency.service';
export * from './outbox.constants';
export * from './outbox-core.module';
export * from './outbox.metrics';
export * from './outbox.module';
export * from './outbox.service';
export * from './outbox.types';
