import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfraModule } from '../infra/infra.module';
import { OutboxCoreModule } from '../outbox';
import { AuditLogCleanupService } from './audit-log-cleanup.service';
import { AuditLogExportService } from './audit-log-export.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InfraModule, AuthModule, OutboxCoreModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogExportService, AuditLogCleanupService],
  exports: [AdminService, AuditLogExportService],
})
export class AdminModule {}
