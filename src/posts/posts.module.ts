import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../connections/connections.module";
import { InfraModule } from "../infra/infra.module";
import { OutboxModule } from "../outbox/outbox.module";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";
import { PostsPolicyService } from "./posts-policy.service";

@Module({
	imports: [InfraModule, OutboxModule, ConnectionsModule],
	controllers: [PostsController],
	providers: [PostsService, PostsPolicyService],
	exports: [PostsService, PostsPolicyService],
})
export class PostsModule {}
