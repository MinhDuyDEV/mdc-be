import { Injectable } from "@nestjs/common";
import type { PrismaService } from "../infra/prisma";

@Injectable()
export class DeadLetterService {
	constructor(private readonly prisma: PrismaService) {}

	async moveToDeadLetter(event: any, error: Error): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.outboxDeadLetter.create({
				data: {
					outboxEventId: event.id,
					eventType: event.eventType,
					payload: event.payload as any,
					reason: error.message,
				},
			});

			await tx.outboxEvent.update({
				where: { id: event.id },
				data: {
					status: "FAILED",
					lockedAt: null,
					lockedBy: null,
				},
			});
		});
	}

	async replay(deadLetterId: string): Promise<void> {
		const deadLetter = await this.prisma.outboxDeadLetter.findUnique({
			where: { id: deadLetterId },
		});

		if (!deadLetter) {
			throw new Error(`Dead letter event not found: ${deadLetterId}`);
		}

		// Create a new PENDING event from the dead-letter payload
		await this.prisma.outboxEvent.create({
			data: {
				eventType: deadLetter.eventType,
				payload: deadLetter.payload as any,
				status: "PENDING",
			},
		});

		// Remove the dead-letter record
		await this.prisma.outboxDeadLetter.delete({
			where: { id: deadLetterId },
		});
	}
}
