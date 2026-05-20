import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxModule } from '../outbox';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
