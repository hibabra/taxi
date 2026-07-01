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
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { ParseTokenPipe } from '../../common/pipes/parse-token.pipe';
import { AcceptUserInvitationDto } from './dto/accept-user-invitation.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInvitationResponseDto } from './dto/user-invitation-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Liste paginée des utilisateurs du groupement courant' })
  async findAll(@CurrentTenant() groupementId: string, @Query() query: ListUsersQueryDto) {
    const result = await this.usersService.findAll(groupementId, {
      isActive: query.isActive,
      limit: query.limit,
      page: query.page,
      role: query.role,
      search: query.search,
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
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_READ)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({ summary: "Détail d'un utilisateur du groupement courant" })
  findOne(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, groupementId);
  }

  @Post('invitations')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_INVITE)
  @Auditable('USER_INVITED')
  @ApiCreatedResponse({ type: UserInvitationResponseDto })
  @ApiOperation({ summary: 'Créer une invitation utilisateur par email' })
  createInvitation(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserInvitationDto,
  ): Promise<UserInvitationResponseDto> {
    return this.usersService.createInvitation(groupementId, user, dto);
  }

  @Public()
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({ summary: 'Accepter une invitation utilisateur' })
  acceptInvitation(
    @Param('token', ParseTokenPipe) token: string,
    @Body() dto: AcceptUserInvitationDto,
  ): Promise<UserResponseDto> {
    return this.usersService.acceptInvitation(token, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_UPDATE)
  @Auditable('USER_UPDATED')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({ summary: 'Modifier un utilisateur du groupement courant' })
  update(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, groupementId, user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_DELETE)
  @Auditable('USER_DEACTIVATED')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({ summary: 'Désactiver un utilisateur et révoquer ses sessions' })
  deactivate(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, groupementId, user);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.USER_UPDATE)
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable('USER_PASSWORD_RESET_REQUESTED')
  @ApiAcceptedResponse({ type: UserInvitationResponseDto })
  @ApiOperation({ summary: 'Envoyer un email de réinitialisation de mot de passe' })
  createPasswordReset(
    @CurrentTenant() groupementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserInvitationResponseDto> {
    return this.usersService.createPasswordReset(id, groupementId, user);
  }

  @Public()
  @Post('reset-password/:token/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Finaliser une réinitialisation de mot de passe' })
  acceptPasswordReset(
    @Param('token', ParseTokenPipe) token: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    return this.usersService.acceptPasswordReset(token, dto);
  }
}
