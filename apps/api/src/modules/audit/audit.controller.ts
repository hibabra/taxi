import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/types/permission.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/role.enum';
import { AuditService } from './audit.service';

/**
 * Controller d'administration du journal d'audit.
 *
 * Tous les endpoints sont réservés au SUPER_ADMIN.
 * En Vague 1, ce controller sert à la vérification
 * manuelle du bon fonctionnement de l'audit.
 * L'interface backoffice sera ajoutée en Vague 4.
 */
@ApiTags('Admin - Audit')
@Controller('admin/audit-logs')
@Roles(UserRole.SUPER_ADMIN)
@Permissions(Permission.AUDIT_READ)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: "Liste les entrées du journal d'audit",
    description:
      'Réservé SUPER_ADMIN. Supporte la pagination et le filtrage par action, utilisateur, période.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'groupementId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('groupementId') groupementId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.auditService.findAll({
      action,
      endDate: endDate ? new Date(endDate) : undefined,
      groupementId,
      limit: Math.min(limit, 100), // Max 100 par page
      page: Math.max(page, 1),
      startDate: startDate ? new Date(startDate) : undefined,
      userId,
    });

    return {
      data: result.data,
      meta: {
        hasNextPage: page * limit < result.total,
        hasPreviousPage: page > 1,
        limit,
        page,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}
