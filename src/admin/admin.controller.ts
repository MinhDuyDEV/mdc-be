import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogExportService } from './audit-log-export.service';
import { AdminService } from './admin.service';
import {
  AdminCompanyQueryDto,
  AdminDeadLetterQueryDto,
  AdminJobQueryDto,
  AdminUserQueryDto,
  AuditLogQueryDto,
  CreateAdminDto,
  UpdateAdminPermissionsDto,
  UpdateUserStatusDto,
  VerifyCompanyDto,
} from './dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly auditLogExport: AuditLogExportService,
  ) {}

  @Get('users')
  @Permissions('MANAGE_USERS')
  async listUsers(@Query() query: AdminUserQueryDto) {
    return this.service.listUsers(query);
  }

  @Patch('users/:id/status')
  @Permissions('MANAGE_USERS')
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.service.updateUserStatus(id, dto, adminId);
    return { data: { success: true } };
  }

  @Get('companies')
  @Permissions('MANAGE_COMPANIES')
  async listCompanies(@Query() query: AdminCompanyQueryDto) {
    return this.service.listCompanies(query);
  }

  @Patch('companies/:id/verification')
  @Permissions('MANAGE_COMPANIES')
  async verifyCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCompanyDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.service.verifyCompany(id, dto, adminId);
    return { data: { success: true } };
  }

  @Get('jobs')
  @Permissions('MANAGE_JOBS')
  async listJobs(@Query() query: AdminJobQueryDto) {
    return this.service.listJobs(query);
  }

  @Get('outbox/dead-letter')
  @Permissions('MANAGE_ADMINS')
  async listDeadLetters(@Query() query: AdminDeadLetterQueryDto) {
    return this.service.listDeadLetters(query);
  }

  @Post('outbox/dead-letter/:id/replay')
  @Permissions('MANAGE_ADMINS')
  async replayDeadLetter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.service.replayDeadLetter(id, adminId);
    return { data: { success: true } };
  }

  // ---------------------------------------------------------------------------
  // Audit Logs
  // ---------------------------------------------------------------------------

  @Get('audit-logs')
  @Permissions('MANAGE_USERS')
  async listAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.service.listAuditLogs(query);
  }

  @Get('audit-logs/export/csv')
  @Permissions('MANAGE_USERS')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  exportAuditLogsCsv(@Query() query: AuditLogQueryDto): StreamableFile {
    const stream = this.auditLogExport.exportCsv(query);
    return new StreamableFile(stream);
  }

  @Get('audit-logs/export/json')
  @Permissions('MANAGE_USERS')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Header('Content-Type', 'application/json')
  exportAuditLogsJson(@Query() query: AuditLogQueryDto): StreamableFile {
    const stream = this.auditLogExport.exportJson(query);
    return new StreamableFile(stream);
  }

  @Get('audit-logs/export/ndjson')
  @Permissions('MANAGE_USERS')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Header('Content-Type', 'application/x-ndjson')
  exportAuditLogsNdjson(@Query() query: AuditLogQueryDto): StreamableFile {
    const stream = this.auditLogExport.exportNdjson(query);
    return new StreamableFile(stream);
  }

  @Get('audit-logs/search')
  @Permissions('MANAGE_USERS')
  async searchAuditLogsByMetadata(
    @Query('metadataKey') metadataKey: string,
    @Query('metadataValue') metadataValue: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditLogExport.searchByMetadata(
      metadataKey,
      metadataValue,
      query,
    );
  }

  // ---------------------------------------------------------------------------
  // Admin Management
  // ---------------------------------------------------------------------------

  @Post('admins')
  @Roles('super_admin')
  @Permissions('MANAGE_ADMINS')
  async createAdmin(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateAdminDto,
  ) {
    const result = await this.service.createAdmin(adminId, dto);
    return { data: result };
  }

  @Delete('admins/:id')
  @Roles('super_admin')
  @Permissions('MANAGE_ADMINS')
  async removeAdmin(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.removeAdmin(adminId, id);
    return { data: { success: true } };
  }

  @Patch('admins/:id/permissions')
  @Roles('super_admin')
  @Permissions('MANAGE_ADMINS')
  async updateAdminPermissions(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminPermissionsDto,
  ) {
    const result = await this.service.updateAdminPermissions(adminId, id, dto);
    return { data: result };
  }

  @Get('admins')
  @Permissions('MANAGE_ADMINS')
  async listAdmins() {
    return this.service.listAdmins();
  }
}
