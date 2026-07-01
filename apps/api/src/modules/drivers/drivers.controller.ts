import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auditable } from '../audit/decorators/auditable.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { Permission } from '../auth/types/permission.enum';
import { UserRole } from '../auth/types/role.enum';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { AcceptDriverInvitationDto } from './dto/accept-driver-invitation.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { CreateDriverInvitationDto } from './dto/create-driver-invitation.dto';
import { DriverInvitationResponseDto } from './dto/driver-invitation-response.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import { SuspendDriverDto } from './dto/suspend-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';
import { ParseTokenPipe } from '../../common/pipes/parse-token.pipe';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller({ path: 'drivers', version: '1' })
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.DRIVER_READ)
  @ApiOperation({ summary: 'Liste paginée des chauffeurs du groupement courant' })
  async findAll(@CurrentTenant() groupementId: string, @Query() query: ListDriversQueryDto) {
    const result = await this.driversService.findAll(groupementId, {
      limit: query.limit,
      matricule: query.matricule,
      page: query.page,
      search: query.search,
      status: query.status,
    });

    return {
      data: result.data,
      meta: {
        hasNextPage: query.page * query.limit < result.total,
        hasPreviousPage: query.page > 1,
        limit: query.limit,
        page: query.page,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.DRIVER_READ)
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: "Détail d'un chauffeur du groupement courant" })
  findOne(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.findOne(id, groupementId);
  }

  @Post('invitations')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_CREATE)
  @Auditable('DRIVER_INVITED')
  @ApiCreatedResponse({ type: DriverInvitationResponseDto })
  @ApiOperation({ summary: 'Inviter un taxi à finaliser son inscription' })
  createInvitation(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDriverInvitationDto,
  ): Promise<DriverInvitationResponseDto> {
    return this.driversService.createInvitation(groupementId, user, dto);
  }

  @Public()
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Accepter une invitation taxi et activer le compte mobile' })
  acceptInvitation(
    @Param('token', ParseTokenPipe) token: string,
    @Body() dto: AcceptDriverInvitationDto,
  ): Promise<DriverResponseDto> {
    return this.driversService.acceptInvitation(token, dto);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_CREATE)
  @Auditable('DRIVER_CREATED')
  @ApiCreatedResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Créer un chauffeur' })
  create(
    @CurrentTenant() groupementId: string,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    return this.driversService.create(groupementId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_UPDATE)
  @Auditable('DRIVER_UPDATED')
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Modifier les informations modifiables du chauffeur' })
  update(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    return this.driversService.update(id, groupementId, dto);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_UPDATE)
  @Auditable('DRIVER_STATUS_CHANGED')
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Suspendre temporairement un chauffeur actif' })
  suspend(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendDriverDto,
  ): Promise<DriverResponseDto> {
    return this.driversService.suspend(id, groupementId, dto);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_UPDATE)
  @Auditable('DRIVER_STATUS_CHANGED')
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Réactiver un chauffeur suspendu' })
  reactivate(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.reactivate(id, groupementId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.DRIVER_DELETE)
  @Auditable('DRIVER_DELETED')
  @ApiOkResponse({ type: DriverResponseDto })
  @ApiOperation({ summary: 'Sortir définitivement un chauffeur du groupement' })
  offboard(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.offboard(id, groupementId);
  }
}
