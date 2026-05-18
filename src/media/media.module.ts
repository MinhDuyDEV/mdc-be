import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { OutboxModule } from '../outbox';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
