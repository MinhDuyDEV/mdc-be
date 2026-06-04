import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config';
import { HealthController, HealthService } from './health';
import { LoggerModule } from './logger';
import {
  MAILER_TRANSPORTER,
  MailerHealthService,
  mailerTransporterProvider,
} from './mailer';
import { OtelShutdownService } from './observability';
import { PrismaService } from './prisma';
import { REDIS_CLIENT, RedisHealthService, redisProvider } from './redis';
import { LeaderLockService } from './scheduling';
import {
  SEARCH_ENGINE_CLIENT,
  SearchEngineHealthService,
  SearchEngineService,
  searchEngineProvider,
} from './search-engine';
import {
  STORAGE_CLIENT,
  StorageHealthService,
  StorageService,
  storageProvider,
} from './storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    redisProvider,
    RedisHealthService,
    storageProvider,
    StorageService,
    StorageHealthService,
    searchEngineProvider,
    SearchEngineService,
    SearchEngineHealthService,
    mailerTransporterProvider,
    MailerHealthService,
    LeaderLockService,
    HealthService,
    OtelShutdownService,
  ],
  exports: [
    ConfigModule,
    PrismaService,
    REDIS_CLIENT,
    RedisHealthService,
    STORAGE_CLIENT,
    StorageService,
    StorageHealthService,
    SEARCH_ENGINE_CLIENT,
    SearchEngineService,
    SearchEngineHealthService,
    MAILER_TRANSPORTER,
    MailerHealthService,
    LeaderLockService,
    HealthService,
    LoggerModule,
  ],
})
export class InfraModule {}
