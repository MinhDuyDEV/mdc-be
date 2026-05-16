import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { InfraModule } from './infra';

@Module({
  imports: [CommonModule, InfraModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
