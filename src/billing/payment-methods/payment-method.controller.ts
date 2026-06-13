import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { CompanyRole } from '../../common/decorators/company-role.decorator';
import { CompanyRoleGuard } from '../../common/guards/company-role.guard';
import { PaymentMethodService } from './payment-method.service';

@Controller('companies/:companyId/payment-methods')
@UseGuards(CompanyRoleGuard)
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post('setup-intent')
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async createSetupIntent(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.paymentMethodService.createSetupIntent(companyId);
  }

  @Post()
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async attachPaymentMethod(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: { providerMethodId: string },
  ) {
    return this.paymentMethodService.attachPaymentMethod(
      companyId,
      body.providerMethodId,
    );
  }

  @Get()
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listPaymentMethods(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.paymentMethodService.listPaymentMethods(companyId);
  }

  @Patch(':id/default')
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentMethodService.setDefault(companyId, id);
  }

  @Delete(':id')
  @CompanyRole('OWNER', 'ADMIN', 'BILLING_ADMIN')
  @HttpCode(HttpStatus.OK)
  async removePaymentMethod(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentMethodService.removePaymentMethod(companyId, id);
  }
}
