import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Auditable } from '../audit/decorators/auditable.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permission } from '../auth/types/permission.enum';
import { UserRole } from '../auth/types/role.enum';
import { GroupementsService } from '../groupements/groupements.service';
import { UpdateGroupementDto } from '../groupements/dto/update-groupement.dto';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { CreateStationDto } from './dto/create-station.dto';
import { StationResponseDto } from './dto/station-response.dto';
import { StationsService } from './stations.service';

@ApiTags('Stations')
@ApiBearerAuth()
@Controller({ path: 'stations', version: '1' })
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly groupementsService: GroupementsService,
  ) {}

  // ── ZONE : lecture de la zone du groupement courant ────────

  @Get('zone')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.STATION_READ)
  @ApiOkResponse({ description: 'Zone du groupement courant' })
  @ApiOperation({ summary: 'Zone géographique du groupement courant' })
  async getZone(@CurrentTenant() groupementId: string) {
      console.log('groupementId =', groupementId);
    const groupement = await this.groupementsService.findOne(groupementId);
      console.log('groupement =', groupement);
    return {
      zoneType: groupement.zoneType,
      zoneLatitude: groupement.zoneLatitude ? Number(groupement.zoneLatitude) : null,
      zoneLongitude: groupement.zoneLongitude ? Number(groupement.zoneLongitude) : null,
      zoneRadiusMeters: groupement.zoneRadiusMeters,
      zonePolygonPoints: groupement.zonePolygonPoints,
      zoneColor: groupement.zoneColor,
    };
  }

  // ── ZONE : mise à jour de la zone du groupement courant ───

  @Patch('zone')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.STATION_UPDATE)
  @Auditable('ZONE_UPDATED')
  @ApiOkResponse({ description: 'Zone mise à jour' })
  @ApiOperation({ summary: 'Mettre à jour la zone géographique du groupement' })
  async updateZone(@CurrentTenant() groupementId: string, @Body() dto: UpdateGroupementDto) {
    // Only allow zone-related fields
    const zoneUpdate: UpdateGroupementDto = {};
    if (dto.zoneType !== undefined) zoneUpdate.zoneType = dto.zoneType;
    if (dto.zoneLatitude !== undefined) zoneUpdate.zoneLatitude = dto.zoneLatitude;
    if (dto.zoneLongitude !== undefined) zoneUpdate.zoneLongitude = dto.zoneLongitude;
    if (dto.zoneRadiusMeters !== undefined) zoneUpdate.zoneRadiusMeters = dto.zoneRadiusMeters;
    if (dto.zonePolygonPoints !== undefined) zoneUpdate.zonePolygonPoints = dto.zonePolygonPoints;
    if (dto.zoneColor !== undefined) zoneUpdate.zoneColor = dto.zoneColor;

    const updated = await this.groupementsService.update(groupementId, zoneUpdate);
    return {
      zoneType: updated.zoneType,
      zoneLatitude: updated.zoneLatitude ? Number(updated.zoneLatitude) : null,
      zoneLongitude: updated.zoneLongitude ? Number(updated.zoneLongitude) : null,
      zoneRadiusMeters: updated.zoneRadiusMeters,
      zonePolygonPoints: updated.zonePolygonPoints,
      zoneColor: updated.zoneColor,
    };
  }

  // GET /stations — liste toutes les stations du groupement
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.STATION_READ)
  @ApiOkResponse({ type: StationResponseDto, isArray: true })
  @ApiOperation({ summary: 'Liste toutes les stations du groupement' })
  findAll(@CurrentTenant() groupementId: string): Promise<StationResponseDto[]> {
    return this.stationsService.findAll(groupementId);
  }

  // GET /stations/:id — détail d'une station
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.STATION_READ)
  @ApiOkResponse({ type: StationResponseDto })
  @ApiOperation({ summary: "Détail d'une station" })
  findOne(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StationResponseDto> {
    return this.stationsService.findOne(id, groupementId);
  }

  // POST /stations — créer une station
  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.STATION_CREATE)
  @Auditable('STATION_CREATED')
  @ApiCreatedResponse({ type: StationResponseDto })
  @ApiOperation({ summary: 'Créer une nouvelle station' })
  create(
    @CurrentTenant() groupementId: string,
    @Body() dto: CreateStationDto,
  ): Promise<StationResponseDto> {
    return this.stationsService.create(groupementId, dto);
  }

  // PATCH /stations/:id — modifier une station
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.STATION_UPDATE)
  @Auditable('STATION_UPDATED')
  @ApiOkResponse({ type: StationResponseDto })
  @ApiOperation({ summary: 'Modifier une station' })
  update(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStationDto,
  ): Promise<StationResponseDto> {
    return this.stationsService.update(id, groupementId, dto);
  }

  // DELETE /stations/:id — supprimer une station
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.STATION_DELETE)
  @Auditable('STATION_DELETED')
  @ApiOkResponse({ type: StationResponseDto })
  @ApiOperation({ summary: 'Supprimer une station' })
  remove(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StationResponseDto> {
    return this.stationsService.remove(id, groupementId);
  }
}
