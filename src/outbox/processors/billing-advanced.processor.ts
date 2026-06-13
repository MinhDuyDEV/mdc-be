import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class BillingAdvancedProcessor {
  private readonly logger = new Logger(BillingAdvancedProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  processSubscriptionUpgraded(payload: {
    subscriptionId: string;
    companyId: string;
    fromPlanId: string;
    toPlanId: string;
  }): void {
    this.logger.log(
      `Subscription ${payload.subscriptionId} upgraded from ${payload.fromPlanId} to ${payload.toPlanId}`,
    );
  }

  processSubscriptionDowngraded(payload: {
    subscriptionId: string;
    companyId: string;
    fromPlanId: string;
    toPlanId: string;
    effectiveAt: string;
  }): void {
    this.logger.log(
      `Subscription ${payload.subscriptionId} downgraded from ${payload.fromPlanId} to ${payload.toPlanId} (effective ${payload.effectiveAt})`,
    );
  }

  processSubscriptionStatusChanged(payload: {
    subscriptionId: string;
    companyId: string;
    fromStatus: string;
    toStatus: string;
  }): void {
    this.logger.log(
      `Subscription ${payload.subscriptionId} status changed: ${payload.fromStatus} -> ${payload.toStatus}`,
    );
  }

  processInvoiceCreated(payload: {
    invoiceId: string;
    companyId: string;
    amountDue: number;
  }): void {
    this.logger.log(
      `Invoice ${payload.invoiceId} created for company ${payload.companyId}, amountDue: ${payload.amountDue}`,
    );
  }

  processInvoicePaymentFailed(payload: {
    invoiceId: string;
    companyId: string;
    attemptNumber: number;
  }): void {
    this.logger.warn(
      `Invoice ${payload.invoiceId} payment failed (attempt ${payload.attemptNumber})`,
    );
  }

  processPaymentMethodAdded(payload: {
    paymentMethodId: string;
    companyId: string;
    type: string;
    isDefault: boolean;
  }): void {
    this.logger.log(
      `Payment method ${payload.paymentMethodId} added for company ${payload.companyId}`,
    );
  }

  processPaymentMethodRemoved(payload: {
    paymentMethodId: string;
    companyId: string;
  }): void {
    this.logger.log(
      `Payment method ${payload.paymentMethodId} removed for company ${payload.companyId}`,
    );
  }

  processUsageThresholdReached(payload: {
    companyId: string;
    meterEventName: string;
    currentValue: number;
    threshold: number;
  }): void {
    this.logger.warn(
      `Usage threshold reached for company ${payload.companyId}: ${payload.meterEventName} = ${payload.currentValue}/${payload.threshold}`,
    );
  }
}
