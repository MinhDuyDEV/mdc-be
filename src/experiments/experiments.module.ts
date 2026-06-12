import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [
    InfraModule,
    OutboxCoreModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
