import { Injectable } from "@nestjs/common";
import type { NotificationPreference } from "@prisma/client";
import type { PrismaService } from "../infra/prisma/prisma.service";
import type { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

@Injectable()
export class NotificationPreferenceService {
	constructor(private readonly prisma: PrismaService) {}

	async getPreferences(userId: string): Promise<NotificationPreference> {
		let preference = await this.prisma.notificationPreference.findUnique({
			where: { userId },
		});

		if (!preference) {
			preference = await this.prisma.notificationPreference.create({
				data: { userId },
			});
		}

		return preference;
	}

	async updatePreferences(
		userId: string,
		dto: UpdateNotificationPreferenceDto,
	): Promise<NotificationPreference> {
		return this.prisma.notificationPreference.upsert({
			where: { userId },
			create: {
				userId,
				...dto,
			},
			update: dto,
		});
	}
}
