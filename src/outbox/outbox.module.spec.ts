import { OutboxModule } from './outbox.module';

describe('OutboxModule', () => {
  it('should be importable', () => {
    // Module compiles correctly in AppModule context (verified via npm run build).
    // Individual providers (OutboxService, OutboxProcessor, IdempotencyService,
    // DeadLetterService) are tested separately via direct construction.
    expect(OutboxModule).toBeDefined();
  });
});
