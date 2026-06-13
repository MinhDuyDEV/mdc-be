import { Module } from '@nestjs/common';
import { GdprModule } from '../gdpr/gdpr.module';
import { InfraModule } from '../infra/infra.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [GdprModule, InfraModule, ProfilesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
