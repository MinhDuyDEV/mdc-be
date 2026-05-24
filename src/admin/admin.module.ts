import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InfraModule, AuthModule, OutboxCoreModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
