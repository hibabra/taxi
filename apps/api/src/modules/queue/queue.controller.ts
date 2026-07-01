import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permission } from '../auth/types/permission.enum';
import { UserRole } from '../auth/types/role.enum';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth-user.interface';
import { QueueResponseDto } from './dto/queue-response.dto';
import { QueueService } from './queue.service';

@ApiTags('Queue')
@ApiBearerAuth()
@Controller({ path: 'queue', version: '1' })
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // GET /queue
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DRIVER)
  @Permissions(Permission.QUEUE_READ)
  @ApiOkResponse({ type: QueueResponseDto })
  @ApiOperation({ summary: 'Voir le tour de rôle du groupement' })
  getQueue(@CurrentTenant() groupementId: string): Promise<QueueResponseDto> {
    return this.queueService.getQueue(groupementId);
  }

  // POST /queue/join
  @Post('join')
  @Roles(UserRole.DRIVER)
  @Permissions(Permission.QUEUE_UPDATE)
  @ApiOkResponse({ type: QueueResponseDto })
  @ApiOperation({ summary: 'Rejoindre la file d attente (statut STATION)' })
  joinQueue(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueResponseDto> {
    return this.queueService.joinQueue(user.driverId!, groupementId);
  }

  // DELETE /queue/leave
  @Delete('leave')
  @Roles(UserRole.DRIVER)
  @Permissions(Permission.QUEUE_UPDATE)
  @ApiOkResponse({ type: QueueResponseDto })
  @ApiOperation({ summary: 'Quitter la file d attente' })
  leaveQueue(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueResponseDto> {
    return this.queueService.leaveQueue(user.driverId!, groupementId);
  }

  // POST /queue/reposition-first
  @Post('reposition-first')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @Permissions(Permission.QUEUE_UPDATE)
  @ApiOkResponse({ type: QueueResponseDto })
  @ApiOperation({ summary: 'Reposition Premier — remettre en tête de file' })
  repositionFirst(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueResponseDto> {
    return this.queueService.repositionFirst(user.driverId!, groupementId);
  }

  // POST /queue/dequeue
  @Post('dequeue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Permissions(Permission.QUEUE_UPDATE)
  @ApiOkResponse({ schema: { example: { driverId: 'uuid' } } })
  @ApiOperation({ summary: 'Retirer le premier chauffeur pour une course' })
  dequeueFirst(@CurrentTenant() groupementId: string): Promise<string | null> {
    return this.queueService.dequeueFirst(groupementId);
  }
}
