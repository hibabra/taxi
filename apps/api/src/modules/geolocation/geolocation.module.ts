import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { RedisModule } from '../core/redis/redis.module';
import { DriverPosition } from './entities/driver-position.entity';
import { GeolocationController } from './geolocation.controller';
import { GeolocationService } from './geolocation.service';
import { GeolocationGateway } from './gateways/geolocation.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([DriverPosition]), AuthModule, TenancyModule, RedisModule],
  controllers: [GeolocationController],
  providers: [GeolocationService, GeolocationGateway],
  exports: [GeolocationService],
})
export class GeolocationModule {}
