import { Global, Module } from '@nestjs/common';
import { InfraModule } from '../infra.module';
import { ApnsService } from './apns.service';
import { FcmService } from './fcm.service';
import { PushService } from './push.service';

/**
 * Push notification infrastructure module.
 *
 * @Global makes PushService available everywhere without explicit imports of
 * this module. The individual providers (FcmService, ApnsService) initialise
 * conditionally based on their enabled flags.
 */
@Global()
@Module({
  imports: [InfraModule],
  providers: [FcmService, ApnsService, PushService],
  exports: [PushService, FcmService, ApnsService],
})
export class PushModule {}
