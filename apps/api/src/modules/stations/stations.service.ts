import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CreateStationDto } from './dto/create-station.dto';
import { StationResponseDto } from './dto/station-response.dto';
import { Station } from './entities/station.entity';
import { STATION_NAME_DUPLICATE, STATION_NOT_FOUND, StationType } from './stations.constants';

@Injectable()
export class StationsService {
  private readonly logger = new Logger(StationsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll(groupementId: string): Promise<StationResponseDto[]> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);
      const stations = await manager.getRepository(Station).find({
        where: { groupementId },
        order: { name: 'ASC' },
      });
      return stations.map(serializeStation);
    });
  }

  async findOne(id: string, groupementId: string): Promise<StationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);
      const station = await manager.getRepository(Station).findOne({
        where: { id, groupementId },
      });
      if (!station) throw new NotFoundException(STATION_NOT_FOUND);
      return serializeStation(station);
    });
  }

  async create(groupementId: string, dto: CreateStationDto): Promise<StationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);
      const repository = manager.getRepository(Station);
      const existing = await repository.findOne({
        where: { groupementId, name: dto.name.trim() },
      });
      if (existing) throw new ConflictException(STATION_NAME_DUPLICATE);

      const station = repository.create({
        groupementId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        address: dto.address?.trim() ?? null,
        type: dto.type, // ✅ CIRCLE ou POLYGON

        latitude: dto.type === StationType.CIRCLE ? (dto.latitude ?? null) : null,
        longitude: dto.type === StationType.CIRCLE ? (dto.longitude ?? null) : null,
        radiusMeters: dto.type === StationType.CIRCLE ? (dto.radiusMeters ?? 50) : null,

        polygonPoints: dto.type === StationType.POLYGON ? (dto.polygonPoints ?? null) : null,

        isActive: true,
      });

      const saved = await repository.save(station);
      this.logger.log({ stationId: saved.id, groupementId }, 'Station created');
      return serializeStation(saved);
    });
  }

  async update(
    id: string,
    groupementId: string,
    dto: Partial<CreateStationDto>,
  ): Promise<StationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);
      const repository = manager.getRepository(Station);
      const station = await repository.findOne({ where: { id, groupementId } });
      if (!station) throw new NotFoundException(STATION_NOT_FOUND);

      if (dto.name && dto.name.trim() !== station.name) {
        const existing = await repository.findOne({
          where: { groupementId, name: dto.name.trim() },
        });
        if (existing) throw new ConflictException(STATION_NAME_DUPLICATE);
        station.name = dto.name.trim();
      }

      if (dto.description !== undefined) station.description = dto.description?.trim() ?? null;
      if (dto.address !== undefined) station.address = dto.address?.trim() ?? null;

      if (dto.type !== undefined) station.type = dto.type;

      if (dto.type === StationType.CIRCLE) {
        if (dto.latitude !== undefined) station.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined) station.longitude = dto.longitude ?? null;
        if (dto.radiusMeters !== undefined) station.radiusMeters = dto.radiusMeters ?? null;
        station.polygonPoints = null;
      }

      if (dto.type === StationType.POLYGON) {
        if (dto.polygonPoints !== undefined) station.polygonPoints = dto.polygonPoints ?? null;
        station.latitude = null;
        station.longitude = null;
        station.radiusMeters = null;
      }

      if (dto.type === undefined) {
        if (dto.latitude !== undefined) station.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined) station.longitude = dto.longitude ?? null;
        if (dto.radiusMeters !== undefined) station.radiusMeters = dto.radiusMeters ?? null;
        if (dto.polygonPoints !== undefined) station.polygonPoints = dto.polygonPoints ?? null;
      }

      const saved = await repository.save(station);
      this.logger.log({ stationId: id, groupementId }, 'Station updated');
      return serializeStation(saved);
    });
  }

  async remove(id: string, groupementId: string): Promise<StationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
        groupementId,
      ]);
      const repository = manager.getRepository(Station);
      const station = await repository.findOne({ where: { id, groupementId } });
      if (!station) throw new NotFoundException(STATION_NOT_FOUND);

      await repository.remove(station);
      this.logger.log({ stationId: id, groupementId }, 'Station deleted');
      return serializeStation({ ...station, id });
    });
  }
}

function serializeStation(station: Station): StationResponseDto {
  return {
    id: station.id,
    groupementId: station.groupementId,
    name: station.name,
    description: station.description,
    address: station.address,
    type: station.type,
    latitude: station.latitude ? Number(station.latitude) : null,
    longitude: station.longitude ? Number(station.longitude) : null,
    radiusMeters: station.radiusMeters ?? null,
    polygonPoints: station.polygonPoints ?? null,
    isActive: station.isActive,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
  };
}
