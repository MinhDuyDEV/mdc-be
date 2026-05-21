import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { AppConfig } from "../infra/config/app-config";
import { InfraModule } from "../infra/infra.module";
import { MessagingModule } from "../messaging/messaging.module";
import { ChatGateway } from "./chat.gateway";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { WsJwtGuard } from "./ws-jwt.guard";

@Module({
	imports: [
		InfraModule,
		MessagingModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) => ({
				secret: config.get("jwtAccessSecret", { infer: true }),
				signOptions: {
					expiresIn: config.get("jwtAccessExpiresIn", { infer: true }),
				},
			}),
		}),
	],
	providers: [RealtimeGateway, ChatGateway, RealtimeService, WsJwtGuard],
	exports: [RealtimeGateway, ChatGateway, RealtimeService],
})
export class RealtimeModule {}
