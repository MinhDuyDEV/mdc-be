import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import type { AppConfig } from './infra';
import { RedisIoAdapter } from './realtime/adapters/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const configService = app.get(ConfigService<AppConfig, true>);

  // Wire Redis-backed Socket.io adapter for multi-instance fan-out
  const role = configService.get('appProcessRole', { infer: true });
  if (role === 'realtime' || role === 'all') {
    const ioAdapter = await RedisIoAdapter.create(app);
    app.useWebSocketAdapter(ioAdapter);
  }

  await app.listen(configService.get('port', { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
