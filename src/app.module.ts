import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { InfraModule } from './infra';
import { SearchModule } from './search';

@Module({
  imports: [CommonModule, InfraModule, SearchModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
