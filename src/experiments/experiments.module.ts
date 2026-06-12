import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [InfraModule, OutboxCoreModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
