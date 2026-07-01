import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permission } from '../auth/types/permission.enum';
import { UserRole } from '../auth/types/role.enum';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { UpdatePositionDto } from './dto/update-position.dto';
import { DriverPositionResponseDto } from './dto/driver-position-response.dto';
import { DriverAvailabilityStatus } from './types/driver-availability.enum';
import { GeolocationService } from './geolocation.service';

class UpdateStatusDto {
  @ApiProperty({ enum: DriverAvailabilityStatus })
  @IsEnum(DriverAvailabilityStatus)
  status!: DriverAvailabilityStatus;
}

@ApiTags('Geolocation')
@ApiBearerAuth()
@Controller({ path: 'geolocation', version: '1' })
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  // POST /geolocation/position
  @Post('position')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @Permissions(Permission.GEOLOCATION_UPDATE)
  @ApiOkResponse({ type: DriverPositionResponseDto })
  @ApiOperation({ summary: 'Mettre à jour la position GPS du chauffeur' })
  updatePosition(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePositionDto,
  ): Promise<DriverPositionResponseDto> {
    return this.geolocationService.updatePosition(user.driverId!, groupementId, dto);
  }
  @Get('history/:driverId')
getHistory(
  @Param('driverId') driverId: string,
) {
  return this.geolocationService
    .getDriverHistory(driverId);
}
  // PATCH /geolocation/status
  @Patch('status')
  @Roles(UserRole.DRIVER)
  @Permissions(Permission.GEOLOCATION_UPDATE)
  @ApiOkResponse({ schema: { example: { driverId: 'uuid', status: 'LIBRE' } } })
  @ApiOperation({ summary: 'Changer le statut de disponibilité' })
  updateStatus(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStatusDto,
  ): Promise<{ driverId: string; status: DriverAvailabilityStatus }> {
    return this.geolocationService.updateStatus(user.driverId!, groupementId, dto.status);
  }

  // GET /geolocation/positions
  @Get('positions')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.GEOLOCATION_READ)
  @ApiOkResponse({ type: DriverPositionResponseDto, isArray: true })
  @ApiOperation({ summary: 'Toutes les positions en temps réel du groupement' })
  getAllPositions(@CurrentTenant() groupementId: string): Promise<DriverPositionResponseDto[]> {
    return this.geolocationService.getAllPositions(groupementId);
  }

  // GET /geolocation/positions/:driverId
  @Get('positions/:driverId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.GEOLOCATION_READ)
  @ApiOkResponse({ type: DriverPositionResponseDto })
  @ApiOperation({ summary: "Position actuelle d'un chauffeur" })
  getPosition(
    @CurrentTenant() groupementId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<DriverPositionResponseDto | null> {
    return this.geolocationService.getPosition(driverId, groupementId);
  }
}
