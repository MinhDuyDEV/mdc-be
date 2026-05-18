import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common";
import { EmailModule } from "./email/email.module";
import { InfraModule } from "./infra";
import type { AppConfig } from "./infra/config";
import { OutboxModule } from "./outbox";
import { SearchModule } from "./search";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ScheduleModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) => {
				const role = config.get("appProcessRole", { infer: true });
				const isWorker = role === "worker" || role === "all";
				return {
					cronJobs: isWorker,
					intervals: isWorker,
					timeouts: false,
				};
			},
		}),
		CommonModule,
		InfraModule,
		AuthModule,
		EmailModule,
		OutboxModule,
		SearchModule,
		UsersModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
