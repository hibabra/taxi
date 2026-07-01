import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, IsNull, Not, QueryFailedError } from 'typeorm';

import { PhoneNormalizationError, toE164 } from '../../common/utils/phone.util';
import { AuditService } from '../audit/audit.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { BlacklistClientDto } from './dto/blacklist-client.dto';
import { CreateClientAddressDto, UpdateClientAddressDto } from './dto/client-address.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientAddress } from './entities/client-address.entity';
import { Client } from './entities/client.entity';

export interface ListClientsOptions {
  includeArchived?: boolean;
  isBlacklisted?: boolean;
  limit: number;
  page: number;
  phone?: string;
  search?: string;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    groupementId: string,
    options: ListClientsOptions,
  ): Promise<{ data: ClientResponseDto[]; total: number }> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const qb = queryRunner.manager
        .getRepository(Client)
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.addresses', 'addresses')
        .where('c.groupement_id = :groupementId', { groupementId });

      if (!options.includeArchived) {
        qb.andWhere('c.archived_at IS NULL');
      }

      if (options.isBlacklisted !== undefined) {
        qb.andWhere('c.is_blacklisted = :isBlacklisted', {
          isBlacklisted: options.isBlacklisted,
        });
      }

      if (options.phone) {
        qb.andWhere('c.phone_e164 = :phoneE164', {
          phoneE164: normalizePhone(options.phone),
        });
      }

      if (options.search) {
        qb.andWhere('(c.full_name ILIKE :search OR c.phone_e164 ILIKE :search)', {
          search: `%${options.search.trim()}%`,
        });
      }

      qb.orderBy('c.createdAt', 'DESC')
        .addOrderBy('addresses.isDefault', 'DESC')
        .addOrderBy('addresses.createdAt', 'ASC')
        .skip((options.page - 1) * options.limit)
        .take(options.limit);

      const [data, total] = await qb.getManyAndCount();

      return { data: data.map(serializeClient), total };
    });
  }

  async searchByPhone(
    groupementId: string,
    phone: string,
    countryCode?: string,
  ): Promise<ClientResponseDto> {
    const phoneE164 = normalizePhone(phone, countryCode);

    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const client = await queryRunner.manager.getRepository(Client).findOne({
        relations: ['addresses'],
        where: { archivedAt: IsNull(), groupementId, phoneE164 },
      });

      if (!client) {
        throw new NotFoundException('Aucun client actif ne correspond à ce téléphone');
      }

      return serializeClient(client);
    });
  }

  async findOne(id: string, groupementId: string): Promise<ClientResponseDto> {
    const client = await this.findClientOrFail(id, groupementId);
    return serializeClient(client);
  }

  async create(groupementId: string, dto: CreateClientDto): Promise<ClientResponseDto> {
    const phoneE164 = normalizePhone(dto.phone, dto.countryCode);

    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      await this.assertPhoneAvailable(manager, groupementId, phoneE164);

      const client = manager.getRepository(Client).create({
        anonymizationRequestedAt: null,
        archivedAt: null,
        blacklistReason: null,
        email: dto.email?.trim().toLowerCase() ?? null,
        fullName: dto.fullName.trim(),
        gender: dto.gender?.trim() || null,
        groupementId,
        isBlacklisted: false,
        notes: dto.notes?.trim() || null,
        phoneE164,
      });

      try {
        const savedClient = await manager.getRepository(Client).save(client);
        await this.createAddressRecords(manager, savedClient, dto.addresses ?? []);

        this.logger.log({ clientId: savedClient.id, groupementId }, 'Client created');
        return serializeClient(
          await this.findClientOrFailInManager(manager, savedClient.id, groupementId),
        );
      } catch (error) {
        this.handlePersistenceError(error);
      }
    });
  }

  async update(id: string, groupementId: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const target = await this.findClientOrFailInManager(manager, id, groupementId);
      this.assertNotArchived(target);

      if (dto.phone !== undefined) {
        const phoneE164 = normalizePhone(dto.phone, dto.countryCode);
        if (phoneE164 !== target.phoneE164) {
          await this.assertPhoneAvailable(manager, groupementId, phoneE164, target.id);
          target.phoneE164 = phoneE164;
        }
      }

      if (dto.fullName !== undefined) target.fullName = dto.fullName.trim();
      if (dto.gender !== undefined) target.gender = dto.gender?.trim() || null;
      if (dto.email !== undefined) target.email = dto.email?.trim().toLowerCase() || null;
      if (dto.notes !== undefined) target.notes = dto.notes?.trim() || null;

      try {
        await manager.getRepository(Client).save(target);
        return this.findClientOrFailInManager(manager, id, groupementId);
      } catch (error) {
        this.handlePersistenceError(error);
      }
    });

    this.logger.log({ clientId: id, groupementId }, 'Client updated');
    return serializeClient(client);
  }

  async archive(id: string, groupementId: string): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const target = await this.findClientOrFailInManager(manager, id, groupementId);

      if (target.archivedAt) {
        throw new GoneException('Cette fiche client est déjà archivée');
      }

      target.archivedAt = new Date();
      await manager.getRepository(Client).save(target);
      return this.findClientOrFailInManager(manager, id, groupementId);
    });

    this.logger.warn({ clientId: id, groupementId }, 'Client archived');
    return serializeClient(client);
  }

  async unarchive(id: string, groupementId: string): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const target = await this.findClientOrFailInManager(manager, id, groupementId);

      if (!target.archivedAt) {
        throw new ConflictException("Cette fiche client n'est pas archivée");
      }

      await this.assertPhoneAvailable(manager, groupementId, target.phoneE164, target.id);
      target.archivedAt = null;
      await manager.getRepository(Client).save(target);
      return this.findClientOrFailInManager(manager, id, groupementId);
    });

    this.logger.log({ clientId: id, groupementId }, 'Client unarchived');
    return serializeClient(client);
  }

  async blacklist(
    id: string,
    groupementId: string,
    dto: BlacklistClientDto,
  ): Promise<ClientResponseDto> {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Le motif de blacklist est obligatoire');
    }

    const { after, before } = await this.tenancyService.withTenantTransaction(
      async (queryRunner) => {
        const manager = queryRunner.manager;
        const target = await this.findClientOrFailInManager(manager, id, groupementId);
        this.assertNotArchived(target);

        const before = auditSnapshot(target);
        target.isBlacklisted = true;
        target.blacklistReason = reason;
        await manager.getRepository(Client).save(target);
        const after = await this.findClientOrFailInManager(manager, id, groupementId);

        return { after, before };
      },
    );

    await this.auditService.log({
      action: 'CLIENT_BLACKLISTED',
      after: auditSnapshot(after),
      before,
      groupementId,
      resourceId: id,
      resourceType: 'Client',
    });

    return serializeClient(after);
  }

  async unblacklist(id: string, groupementId: string): Promise<ClientResponseDto> {
    const { after, before } = await this.tenancyService.withTenantTransaction(
      async (queryRunner) => {
        const manager = queryRunner.manager;
        const target = await this.findClientOrFailInManager(manager, id, groupementId);
        this.assertNotArchived(target);

        const before = auditSnapshot(target);
        target.isBlacklisted = false;
        target.blacklistReason = null;
        await manager.getRepository(Client).save(target);
        const after = await this.findClientOrFailInManager(manager, id, groupementId);

        return { after, before };
      },
    );

    await this.auditService.log({
      action: 'CLIENT_UNBLACKLISTED',
      after: auditSnapshot(after),
      before,
      groupementId,
      resourceId: id,
      resourceType: 'Client',
    });

    return serializeClient(after);
  }

  async addAddress(
    clientId: string,
    groupementId: string,
    dto: CreateClientAddressDto,
  ): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const client = await this.findClientOrFailInManager(manager, clientId, groupementId);
      this.assertNotArchived(client);

      await this.createAddressRecords(manager, client, [dto]);
      return this.findClientOrFailInManager(manager, clientId, groupementId);
    });

    return serializeClient(client);
  }

  async updateAddress(
    clientId: string,
    addressId: string,
    groupementId: string,
    dto: UpdateClientAddressDto,
  ): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const client = await this.findClientOrFailInManager(manager, clientId, groupementId);
      this.assertNotArchived(client);

      const address = client.addresses.find((candidate) => candidate.id === addressId);
      if (!address) {
        throw new NotFoundException(`Adresse ${addressId} introuvable`);
      }

      if (dto.isDefault === true) {
        await this.clearDefaultAddresses(manager, clientId, groupementId, address.id);
        address.isDefault = true;
      } else if (dto.isDefault === false) {
        address.isDefault = false;
      }

      if (dto.label !== undefined) address.label = dto.label.trim();
      if (dto.addressLine1 !== undefined) address.addressLine1 = dto.addressLine1.trim();
      if (dto.addressLine2 !== undefined) address.addressLine2 = dto.addressLine2?.trim() || null;
      if (dto.postalCode !== undefined) address.postalCode = dto.postalCode.trim();
      if (dto.city !== undefined) address.city = dto.city.trim();
      if (dto.countryCode !== undefined) address.countryCode = dto.countryCode.toUpperCase();

      await manager.getRepository(ClientAddress).save(address);
      return this.findClientOrFailInManager(manager, clientId, groupementId);
    });

    return serializeClient(client);
  }

  async deleteAddress(
    clientId: string,
    addressId: string,
    groupementId: string,
  ): Promise<ClientResponseDto> {
    const client = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const client = await this.findClientOrFailInManager(manager, clientId, groupementId);
      this.assertNotArchived(client);

      const target = client.addresses.find((address) => address.id === addressId);
      if (!target) {
        throw new NotFoundException(`Adresse ${addressId} introuvable`);
      }

      await manager.getRepository(ClientAddress).remove(target);

      if (target.isDefault) {
        const nextDefault = client.addresses.find((address) => address.id !== addressId);
        if (nextDefault) {
          nextDefault.isDefault = true;
          await manager.getRepository(ClientAddress).save(nextDefault);
        }
      }

      return this.findClientOrFailInManager(manager, clientId, groupementId);
    });

    return serializeClient(client);
  }

  private async findClientOrFail(id: string, groupementId: string): Promise<Client> {
    return this.tenancyService.withTenantTransaction((queryRunner) =>
      this.findClientOrFailInManager(queryRunner.manager, id, groupementId),
    );
  }

  private async findClientOrFailInManager(
    manager: EntityManager,
    id: string,
    groupementId: string,
  ): Promise<Client> {
    const client = await manager.getRepository(Client).findOne({
      relations: ['addresses'],
      where: { groupementId, id },
    });

    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }

    return client;
  }

  private async assertPhoneAvailable(
    manager: EntityManager,
    groupementId: string,
    phoneE164: string,
    exceptClientId?: string,
  ): Promise<void> {
    const existing = await manager.getRepository(Client).findOne({
      where: {
        groupementId,
        id: exceptClientId ? Not(exceptClientId) : undefined,
        phoneE164,
      },
    });

    if (existing) {
      throwClientPhoneConflict(existing.id);
    }
  }

  private async createAddressRecords(
    manager: EntityManager,
    client: Client,
    addresses: CreateClientAddressDto[],
  ): Promise<void> {
    if (addresses.length === 0) {
      return;
    }

    const existingAddresses = client.addresses ?? [];
    const hasExistingDefault = existingAddresses.some((address) => address.isDefault);
    const hasRequestedDefault = addresses.some((address) => address.isDefault === true);
    const shouldPromoteFirst = !hasExistingDefault && !hasRequestedDefault;

    for (const [index, dto] of addresses.entries()) {
      const isDefault = dto.isDefault === true || (shouldPromoteFirst && index === 0);

      if (isDefault) {
        await this.clearDefaultAddresses(manager, client.id, client.groupementId);
      }

      await manager.getRepository(ClientAddress).save(
        manager.getRepository(ClientAddress).create({
          addressLine1: dto.addressLine1.trim(),
          addressLine2: dto.addressLine2?.trim() || null,
          city: dto.city.trim(),
          clientId: client.id,
          countryCode: (dto.countryCode ?? 'FR').toUpperCase(),
          groupementId: client.groupementId,
          isDefault,
          label: dto.label.trim(),
          postalCode: dto.postalCode.trim(),
        }),
      );
    }
  }

  private async clearDefaultAddresses(
    manager: EntityManager,
    clientId: string,
    groupementId: string,
    exceptAddressId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(ClientAddress)
      .createQueryBuilder()
      .update(ClientAddress)
      .set({ isDefault: false })
      .where('client_id = :clientId', { clientId })
      .andWhere('groupement_id = :groupementId', { groupementId });

    if (exceptAddressId) {
      qb.andWhere('id <> :exceptAddressId', { exceptAddressId });
    }

    await qb.execute();
  }

  private assertNotArchived(client: Client): void {
    if (client.archivedAt) {
      throw new GoneException('Cette fiche client est archivée');
    }
  }

  private handlePersistenceError(error: unknown): never {
    if (isUniqueViolation(error)) {
      throwClientPhoneConflict();
    }

    throw error;
  }
}

function serializeClient(client: Client): ClientResponseDto {
  const addresses = [...(client.addresses ?? [])].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  return {
    addresses: addresses.map((address) => ({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      clientId: address.clientId,
      countryCode: address.countryCode,
      id: address.id,
      isDefault: address.isDefault,
      label: address.label,
      postalCode: address.postalCode,
    })),
    anonymizationRequestedAt: client.anonymizationRequestedAt,
    archivedAt: client.archivedAt,
    blacklistReason: client.blacklistReason,
    createdAt: client.createdAt,
    email: client.email,
    fullName: client.fullName,
    gender: client.gender,
    groupementId: client.groupementId,
    id: client.id,
    isBlacklisted: client.isBlacklisted,
    notes: client.notes,
    phoneE164: client.phoneE164,
    updatedAt: client.updatedAt,
  };
}

function auditSnapshot(client: Client): Record<string, unknown> {
  return {
    archivedAt: client.archivedAt,
    blacklistReason: client.blacklistReason,
    fullName: client.fullName,
    id: client.id,
    isBlacklisted: client.isBlacklisted,
    phoneE164: client.phoneE164,
  };
}

function normalizePhone(phone: string, countryCode?: string): string {
  try {
    return toE164(phone, countryCode ?? 'FR');
  } catch (error) {
    if (error instanceof PhoneNormalizationError) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }
}

function throwClientPhoneConflict(existingClientId?: string): never {
  throw new ConflictException({
    code: 'CLIENT_PHONE_ALREADY_EXISTS',
    details: existingClientId ? [{ existingClientId }] : [],
    message: 'Un client avec ce téléphone existe déjà dans ce groupement',
  });
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string };
  return driverError.code === '23505';
}
