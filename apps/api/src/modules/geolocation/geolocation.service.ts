import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../core/redis/redis.constants';
import { Driver } from '../drivers/entities/driver.entity';
import { UpdatePositionDto } from './dto/update-position.dto';
import { DriverPositionResponseDto } from './dto/driver-position-response.dto';
import { DriverPosition } from './entities/driver-position.entity';
import { DriverAvailabilityStatus } from './types/driver-availability.enum';
import { GeolocationGateway } from './gateways/geolocation.gateway';
import {
  DRIVER_NOT_FOUND,
  DRIVER_POSITION_KEY,
  DRIVER_STATUS_KEY,
  GROUPEMENT_DRIVERS_KEY,
  POSITION_TTL_SECONDS,
} from './geolocation.constants';

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly gateway: GeolocationGateway,
  ) {}

  async updatePosition(
    driverId: string,
    groupementId: string,
    dto: UpdatePositionDto,
  ): Promise<DriverPositionResponseDto> {
    const driver = await this.dataSource.manager
      .getRepository(Driver)
      .findOne({ where: { id: driverId, groupementId } });

    if (!driver) throw new NotFoundException(DRIVER_NOT_FOUND);

    const now = new Date();

    const currentStatusRaw = await this.redis.get(DRIVER_STATUS_KEY(driverId));
    const currentStatus =
      (currentStatusRaw as DriverAvailabilityStatus) ?? DriverAvailabilityStatus.LIBRE;

    const newStatus = dto.status ?? currentStatus;

    const positionData = {
      driverId,
      groupementId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      status: newStatus,
      recordedAt: now.toISOString(),
    };

    await this.redis.setex(
      DRIVER_POSITION_KEY(driverId),
      POSITION_TTL_SECONDS,
      JSON.stringify(positionData),
    );

    await this.redis.setex(DRIVER_STATUS_KEY(driverId), POSITION_TTL_SECONDS, newStatus);

    await this.redis.sadd(GROUPEMENT_DRIVERS_KEY(groupementId), driverId);

    await this.dataSource.manager.getRepository(DriverPosition).save({
      driverId,
      groupementId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      status: newStatus,
    });

    this.gateway.emitPositionUpdate(groupementId, {
      driverId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      status: newStatus,
      recordedAt: now.toISOString(),
    });

    this.logger.log(
      { driverId, lat: dto.latitude, lng: dto.longitude, status: newStatus },
      'Position updated',
    );

    return positionData as unknown as DriverPositionResponseDto;
  }

  async updateStatus(
    driverId: string,
    groupementId: string,
    status: DriverAvailabilityStatus,
  ): Promise<{ driverId: string; status: DriverAvailabilityStatus }> {
    const driver = await this.dataSource.manager
      .getRepository(Driver)
      .findOne({ where: { id: driverId, groupementId } });

    if (!driver) throw new NotFoundException(DRIVER_NOT_FOUND);

    await this.redis.setex(DRIVER_STATUS_KEY(driverId), POSITION_TTL_SECONDS, status);

    await this.redis.sadd(GROUPEMENT_DRIVERS_KEY(groupementId), driverId);

    this.logger.log({ driverId, status }, 'Status updated');

    return { driverId, status };
  }
async getDriverHistory(
  driverId: string,
  limit = 50,
) {
  return this.dataSource
    .getRepository(DriverPosition)
    .find({
      where: { driverId },
      order: {
        recordedAt: 'DESC'
      },
      take: limit,
    });
}
  async getPosition(
    driverId: string,
    groupementId: string,
  ): Promise<DriverPositionResponseDto | null> {
    const raw = await this.redis.get(DRIVER_POSITION_KEY(driverId));
    if (!raw) return null;
    const position = JSON.parse(raw) as DriverPositionResponseDto;
    if (position.groupementId !== groupementId) return null;
    return position;
  }
 async getAllPositions(groupementId: string): Promise<DriverPositionResponseDto[]> {
  // Toujours lire la dernière position connue depuis PostgreSQL
  const rows = await this.dataSource.manager.query<DriverPositionResponseDto[]>(
    `
    SELECT DISTINCT ON (dp."driver_id")
      dp."driver_id"      AS "driverId",
      dp."groupement_id"  AS "groupementId",
      dp.latitude,
      dp.longitude,
      dp.accuracy,
      dp.speed,
      dp.heading,
      dp.status,
      dp."recorded_at"    AS "recordedAt"
    FROM driver_positions dp
    WHERE dp."groupement_id" = $1
    ORDER BY dp."driver_id", dp."recorded_at" DESC
    `,
    [groupementId],
  );

  // Réalimenter Redis avec les données fraîches
  for (const pos of rows) {
    const data = { ...pos, recordedAt: new Date(pos.recordedAt).toISOString() };
    await this.redis.setex(
      DRIVER_POSITION_KEY(pos.driverId),
      POSITION_TTL_SECONDS,
      JSON.stringify(data),
    );
    await this.redis.sadd(GROUPEMENT_DRIVERS_KEY(groupementId), pos.driverId);
  }

  this.logger.log({ groupementId, count: rows.length }, 'getAllPositions from PostgreSQL');

  return rows;
}
}
