import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { validateEnv } from './config';
import { HealthController, HealthService } from './health';
import { PrismaService } from './prisma';
import { RedisHealthService, redisProvider } from './redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, redisProvider, RedisHealthService, HealthService],
  exports: [ConfigModule, PrismaService, redisProvider, RedisHealthService, HealthService],
})
export class InfraModule {}
