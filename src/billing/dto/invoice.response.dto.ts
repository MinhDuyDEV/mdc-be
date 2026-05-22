import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class InvoiceLineItemResponseDto {
	@Expose()
	id!: string;

	@Expose()
	description!: string;

	@Expose()
	quantity!: number;

	@Expose()
	unitAmount!: number;

	@Expose()
	amount!: number;
}

@Exclude()
export class InvoiceResponseDto {
	@Expose()
	id!: string;

	@Expose()
	subscriptionId!: string;

	@Expose()
	companyId!: string;

	@Expose()
	invoiceNumber!: string | null;

	@Expose()
	status!: string;

	@Expose()
	amountDue!: number;

	@Expose()
	amountPaid!: number;

	@Expose()
	currency!: string;

	@Expose()
	periodStart!: Date;

	@Expose()
	periodEnd!: Date;

	@Expose()
	dueDate!: Date | null;

	@Expose()
	paidAt!: Date | null;

	@Expose()
	providerInvoiceUrl!: string | null;

	@Expose()
	createdAt!: Date;

	@Expose()
	@Type(() => InvoiceLineItemResponseDto)
	lineItems?: InvoiceLineItemResponseDto[];
}
