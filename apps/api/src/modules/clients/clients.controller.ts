import {
  Body,
  Controller,
  Delete,
  Get,
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

import { Auditable } from '../audit/decorators/auditable.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/types/permission.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/role.enum';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { BlacklistClientDto } from './dto/blacklist-client.dto';
import { CreateClientAddressDto, UpdateClientAddressDto } from './dto/client-address.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { SearchClientQueryDto } from './dto/search-client-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_READ)
  @ApiOperation({ summary: 'Liste paginée des clients du groupement courant' })
  async findAll(@CurrentTenant() groupementId: string, @Query() query: ListClientsQueryDto) {
    const result = await this.clientsService.findAll(groupementId, {
      includeArchived: query.includeArchived,
      isBlacklisted: query.isBlacklisted,
      limit: query.limit,
      page: query.page,
      phone: query.phone,
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

  @Get('search')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_READ)
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Rechercher un client actif par téléphone normalisé' })
  searchByPhone(
    @CurrentTenant() groupementId: string,
    @Query() query: SearchClientQueryDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.searchByPhone(groupementId, query.phone, query.countryCode);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_READ)
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: "Détail d'un client avec ses adresses" })
  findOne(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.findOne(id, groupementId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_CREATE)
  @Auditable('CLIENT_CREATED')
  @ApiCreatedResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Créer une fiche client' })
  create(
    @CurrentTenant() groupementId: string,
    @Body() dto: CreateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.create(groupementId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @Auditable('CLIENT_UPDATED')
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Modifier une fiche client active' })
  update(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.update(id, groupementId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_DELETE)
  @Auditable('CLIENT_ARCHIVED')
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Archiver une fiche client' })
  archive(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.archive(id, groupementId);
  }

  @Post(':id/unarchive')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @Auditable('CLIENT_UNARCHIVED')
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Désarchiver une fiche client' })
  unarchive(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.unarchive(id, groupementId);
  }

  @Post(':id/blacklist')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Mettre un client en liste noire avec motif' })
  blacklist(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlacklistClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.blacklist(id, groupementId, dto);
  }

  @Post(':id/unblacklist')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Retirer un client de la liste noire' })
  unblacklist(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.unblacklist(id, groupementId);
  }

  @Post(':id/addresses')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @Auditable('CLIENT_ADDRESS_CREATED')
  @ApiCreatedResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Ajouter une adresse client' })
  addAddress(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientAddressDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.addAddress(id, groupementId, dto);
  }

  @Patch(':id/addresses/:addressId')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @Auditable('CLIENT_ADDRESS_UPDATED')
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Modifier une adresse client' })
  updateAddress(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateClientAddressDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.updateAddress(id, addressId, groupementId, dto);
  }

  @Delete(':id/addresses/:addressId')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.CLIENT_UPDATE)
  @Auditable('CLIENT_ADDRESS_DELETED')
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiOperation({ summary: 'Supprimer une adresse client' })
  deleteAddress(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.deleteAddress(id, addressId, groupementId);
  }
}
