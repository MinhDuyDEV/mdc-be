import { Injectable } from "@nestjs/common";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { OutboxService } from "../outbox/outbox.service";

@Injectable()
export class BillingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly outboxService: OutboxService,
	) {}
}
