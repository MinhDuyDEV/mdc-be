import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { DeadLetterService } from './dead-letter.service';
import { IdempotencyService } from './idempotency.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [InfraModule],
  providers: [DeadLetterService, IdempotencyService, OutboxService],
  exports: [DeadLetterService, IdempotencyService, OutboxService],
})
export class OutboxCoreModule {}
