import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [InfraModule, OutboxCoreModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
