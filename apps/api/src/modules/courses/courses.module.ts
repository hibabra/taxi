import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Client } from '../clients/entities/client.entity';
import { ClientsModule } from '../clients/clients.module';
import { Driver } from '../drivers/entities/driver.entity';
import { DriversModule } from '../drivers/drivers.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Driver, Client]),
    AuthModule,
    TenancyModule,
    AuditModule,
    DriversModule,
    ClientsModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
