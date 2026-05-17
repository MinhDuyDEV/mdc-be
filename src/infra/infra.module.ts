import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config';
import { HealthController, HealthService } from './health';
import { LoggerModule } from './logger';
import {
  MAILER_TRANSPORTER,
  MailerHealthService,
  MailerService,
  mailerTransporterProvider,
} from './mailer';
import { PrismaService } from './prisma';
import { REDIS_CLIENT, RedisHealthService, redisProvider } from './redis';
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
    MailerService,
    MailerHealthService,
    HealthService,
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
    MailerService,
    MailerHealthService,
    HealthService,
    LoggerModule,
  ],
})
export class InfraModule {}
