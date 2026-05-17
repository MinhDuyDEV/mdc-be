import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config';
import { HealthController, HealthService } from './health';
import { LoggerModule } from './logger';
import { PrismaService } from './prisma';
import { REDIS_CLIENT, RedisHealthService, redisProvider } from './redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, redisProvider, RedisHealthService, HealthService],
  exports: [
    ConfigModule,
    PrismaService,
    REDIS_CLIENT,
    RedisHealthService,
    HealthService,
  ],
})
export class InfraModule {}
