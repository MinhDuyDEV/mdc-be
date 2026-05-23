import { Module } from '@nestjs/common';
import { OutboxCoreModule } from './outbox-core.module';

/**
 * Backward-compatible alias for modules that need transactional outbox services.
 * New code should import OutboxCoreModule directly.
 */
@Module({
  imports: [OutboxCoreModule],
  exports: [OutboxCoreModule],
})
export class OutboxModule {}
