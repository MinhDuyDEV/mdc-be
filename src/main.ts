import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { type AppConfig } from './infra';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  const configService = app.get(ConfigService<AppConfig, true>);
  await app.listen(configService.get('port', { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
