import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../infra/config';
import { STRIPE_PORT } from '../ports/stripe.port';
import { MockStripeService } from './mock-stripe.service';
import { StripeService } from './stripe.service';

function stripePortFactory(configService: ConfigService<AppConfig, true>) {
  const enabled = configService.get('stripeEnabled', { infer: true });
  if (enabled) {
    return new StripeService(configService);
  }
  return new MockStripeService();
}

@Module({
  providers: [
    {
      provide: STRIPE_PORT,
      useFactory: stripePortFactory,
      inject: [ConfigService],
    },
  ],
  exports: [STRIPE_PORT],
})
export class StripeModule {}
