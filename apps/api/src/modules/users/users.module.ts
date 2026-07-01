import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { UserInvitation } from './entities/user-invitation.entity';
import { User } from './entities/user.entity';
import { USERS_EMAIL_QUEUE } from './users.constants';
import { UsersController } from './users.controller';
import { UsersEmailProcessor } from './users-email.processor';
import { UsersMailerService } from './users-mailer.service';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInvitation]),
    BullModule.registerQueue({ name: USERS_EMAIL_QUEUE }),
    AuthModule,
    TenancyModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersMailerService, UsersEmailProcessor],
  exports: [UsersService],
})
export class UsersModule {}
