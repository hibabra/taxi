import {
  Body,
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Auditable } from '../audit/decorators/auditable.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/types/permission.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../auth/types/role.enum';
import { DriversService } from '../drivers/drivers.service';
import { CreateGroupementDto } from './dto/create-groupement.dto';
import { UpdateGroupementDto } from './dto/update-groupement.dto';
import { UpdateGroupementSettingsDto } from './dto/update-groupement-settings.dto';
import { GroupementsService } from './groupements.service';

/**
 * Controller Groupements — creation et supervision reservees SUPER_ADMIN.
 *
 * Ce module ne filtre PAS par groupement_id car le groupement
 * est l'objet des opérations, pas le filtre.
 */
@ApiTags('Groupements')
@Controller({ path: 'groupements', version: '1' })
@Roles(UserRole.SUPER_ADMIN)
export class GroupementsController {
  constructor(
    private readonly groupementsService: GroupementsService,
    private readonly driversService: DriversService,
  ) {}

  // ── LIST ──────────────────────────────────────────────────

  @Get()
  @Permissions(Permission.GROUPEMENT_READ)
  @ApiOperation({ summary: 'Liste paginée des groupements' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive', new DefaultValuePipe(undefined)) isActive?: string,
    @Query('search') search?: string,
  ) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await this.groupementsService.findAll({
      isActive: parseOptionalBooleanQuery(isActive, 'isActive'),
      limit: safeLimit,
      page: safePage,
      search,
    });

    return {
      data: result.data,
      meta: {
        hasNextPage: safePage * safeLimit < result.total,
        hasPreviousPage: safePage > 1,
        limit: safeLimit,
        page: safePage,
        total: result.total,
        totalPages: Math.ceil(result.total / safeLimit),
      },
    };
  }

  // ── GET ONE ───────────────────────────────────────────────

  @Get(':id')
  @Permissions(Permission.GROUPEMENT_READ)
  @ApiOperation({ summary: "Détail d'un groupement avec ses settings" })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupementsService.findOne(id);
  }

  // ── CREATE ────────────────────────────────────────────────

  @Post()
  @Permissions(Permission.GROUPEMENT_CREATE)
  @Auditable('GROUPEMENT_CREATED')
  @ApiOperation({ summary: 'Créer un nouveau groupement et inviter son premier admin' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupementDto) {
    const { initialAdmin, ...groupementDto } = dto;
    const groupement = await this.groupementsService.create(groupementDto);
    const adminInvitation = await this.driversService.createGroupAdminInvitation(
      groupement.id,
      user,
      initialAdmin,
    );

    return { adminInvitation, groupement };
  }

  // ── UPDATE ────────────────────────────────────────────────

  @Patch(':id')
  @Permissions(Permission.GROUPEMENT_UPDATE)
  @Auditable('GROUPEMENT_UPDATED')
  @ApiOperation({ summary: "Mise à jour partielle d'un groupement" })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupementDto) {
    return this.groupementsService.update(id, dto);
  }

  // ── UPDATE SETTINGS ───────────────────────────────────────

  @Patch(':id/settings')
  @Permissions(Permission.GROUPEMENT_UPDATE)
  @Auditable('GROUPEMENT_SETTINGS_UPDATED')
  @ApiOperation({ summary: 'Mise à jour des paramètres métier' })
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupementSettingsDto,
  ) {
    return this.groupementsService.updateSettings(id, dto);
  }

  // ── DEACTIVATE (soft delete) ──────────────────────────────

  @Patch(':id/deactivate')
  @Permissions(Permission.GROUPEMENT_DELETE)
  @Auditable('GROUPEMENT_DEACTIVATED')
  @ApiOperation({ summary: 'Désactiver un groupement (soft delete)' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupementsService.deactivate(id);
  }

  // ── DELETE (hard delete) ─────────────────────────────────

  @Delete(':id')
  @Permissions(Permission.GROUPEMENT_DELETE)
  @Auditable('GROUPEMENT_DELETED')
  @ApiOperation({ summary: 'Supprimer définitivement un groupement sans données métier' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupementsService.remove(id);
  }
}

function parseOptionalBooleanQuery(
  value: string | undefined,
  fieldName: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new BadRequestException(`Le paramètre ${fieldName} doit valoir true ou false`);
}
