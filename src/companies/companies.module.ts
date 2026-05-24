import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CommonModule } from '../common';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [CommonModule, InfraModule, OutboxCoreModule, BillingModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
