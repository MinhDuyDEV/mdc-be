import { Module } from "@nestjs/common";
import { InfraModule } from "../infra/infra.module";
import { EmailProcessor } from "./email.processor";
import { EmailService } from "./email.service";

@Module({
  imports: [InfraModule],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
