import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Groupement } from '../groupements/entities/groupement.entity';
import { TenancyModule } from '../tenancy/tenancy.module';
import { User } from '../users/entities/user.entity';
import { USERS_EMAIL_QUEUE } from '../users/users.constants';
import { DriverInvitation } from './entities/driver-invitation.entity';
import { Driver } from './entities/driver.entity';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverInvitation, Groupement, User]),
    BullModule.registerQueue({ name: USERS_EMAIL_QUEUE }),
    AuthModule,
    TenancyModule,
    AuditModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
