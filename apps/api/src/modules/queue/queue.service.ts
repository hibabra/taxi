import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../core/redis/redis.constants';
import { Driver } from '../drivers/entities/driver.entity';
import { DriverAvailabilityStatus } from '../geolocation/types/driver-availability.enum';
import { DRIVER_STATUS_KEY } from '../geolocation/geolocation.constants';
import { QueueEntryDto, QueueResponseDto } from './dto/queue-response.dto';
import { DRIVER_ALREADY_IN_QUEUE, DRIVER_NOT_IN_QUEUE, QUEUE_KEY } from './queue.constants';

const STATUS_ORDER: Record<string, number> = {
  STATION: 0,
  LIBRE: 1,
  COURSE: 2,
  ABSENT: 3,
  HORS_SERVICE: 4,
};

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async getQueue(groupementId: string): Promise<QueueResponseDto> {
    const entries = await this.redis.lrange(QUEUE_KEY(groupementId), 0, -1);
    if (entries.length === 0) {
      return { groupementId, total: 0, entries: [] };
    }

    const drivers = await this.dataSource.manager
      .getRepository(Driver)
      .createQueryBuilder('d')
      .where('d.id IN (:...ids)', { ids: entries })
      .andWhere('d.groupement_id = :groupementId', { groupementId })
      .getMany();

    const statusKeys = entries.map(DRIVER_STATUS_KEY);
    const statuses = await this.redis.mget(...statusKeys);

    const queueEntries: QueueEntryDto[] = [];
    for (let i = 0; i < entries.length; i++) {
      const driverId = entries[i];
      const driver = drivers.find((d) => d.id === driverId);
      if (!driver) continue;

      const entryRaw = statuses[i];
      const status = (entryRaw as DriverAvailabilityStatus) ?? DriverAvailabilityStatus.STATION;

      queueEntries.push({
        position: i + 1,
        driverId,
        driverIdentifier: driver.driverIdentifier,
        firstName: driver.firstName,
        lastName: driver.lastName,
        status,
        joinedQueueAt: new Date().toISOString(),
      });
    }

    const sorted = [...queueEntries].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 99;
      const orderB = STATUS_ORDER[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.position - b.position;
    });

    sorted.forEach((e, i) => {
      e.position = i + 1;
    });

    return { groupementId, total: sorted.length, entries: sorted };
  }

  async joinQueue(driverId: string, groupementId: string): Promise<QueueResponseDto> {
    this.logger.log({ driverId, groupementId }, 'joinQueue CALLED');

    const driver = await this.dataSource.manager
      .getRepository(Driver)
      .findOne({ where: { id: driverId, groupementId } });

    if (!driver) throw new NotFoundException('Chauffeur introuvable');

    const queue = await this.redis.lrange(QUEUE_KEY(groupementId), 0, -1);
    if (queue.includes(driverId)) {
      throw new ConflictException(DRIVER_ALREADY_IN_QUEUE);
    }

    await this.redis.rpush(QUEUE_KEY(groupementId), driverId);
    await this.redis.setex(DRIVER_STATUS_KEY(driverId), 86400, DriverAvailabilityStatus.STATION);

    this.logger.log({ driverId, groupementId }, 'Driver joined queue');
    return this.getQueue(groupementId);
  }

  async leaveQueue(driverId: string, groupementId: string): Promise<QueueResponseDto> {
    const queue = await this.redis.lrange(QUEUE_KEY(groupementId), 0, -1);

    if (!queue.includes(driverId)) {
      throw new NotFoundException(DRIVER_NOT_IN_QUEUE);
    }

    await this.redis.lrem(QUEUE_KEY(groupementId), 1, driverId);
    this.logger.log({ driverId, groupementId }, 'Driver left queue');
    return this.getQueue(groupementId);
  }

  async repositionFirst(driverId: string, groupementId: string): Promise<QueueResponseDto> {
    await this.redis.lrem(QUEUE_KEY(groupementId), 1, driverId);
    await this.redis.lpush(QUEUE_KEY(groupementId), driverId);
    this.logger.log({ driverId, groupementId }, 'Driver repositioned first');
    return this.getQueue(groupementId);
  }

  async dequeueFirst(groupementId: string): Promise<string | null> {
    const driverId = await this.redis.lpop(QUEUE_KEY(groupementId));
    if (!driverId) return null;

    await this.redis.setex(DRIVER_STATUS_KEY(driverId), 86400, DriverAvailabilityStatus.COURSE);

    this.logger.log({ driverId, groupementId }, 'Driver dequeued for course');
    return driverId;
  }
}
