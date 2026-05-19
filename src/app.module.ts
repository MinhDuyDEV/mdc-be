import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common";
import { CompaniesModule } from "./companies/companies.module";
import { EmailModule } from "./email/email.module";
import { InfraModule } from "./infra";
import type { AppConfig } from "./infra/config";
import { REDIS_CLIENT } from "./infra/redis/redis.constants";
import { MediaModule } from "./media/media.module";
import { OutboxModule } from "./outbox";
import { ProfilesModule } from "./profiles/profiles.module";
import { SearchModule } from "./search";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ThrottlerModule.forRootAsync({
			imports: [InfraModule],
			inject: [REDIS_CLIENT],
			useFactory: (redisClient: import("ioredis").Redis) => ({
				throttlers: [{ limit: 10, ttl: 60000 }],
				storage: new ThrottlerStorageRedisService(redisClient),
			}),
		}),
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
		CompaniesModule,
		EmailModule,
		MediaModule,
		OutboxModule,
		ProfilesModule,
		SearchModule,
		UsersModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
