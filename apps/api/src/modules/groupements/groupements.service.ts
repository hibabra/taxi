import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';

import { CreateGroupementDto } from './dto/create-groupement.dto';
import { UpdateGroupementDto } from './dto/update-groupement.dto';
import { UpdateGroupementSettingsDto } from './dto/update-groupement-settings.dto';
import { GroupementSettings } from './entities/groupement-settings.entity';
import { Groupement } from './entities/groupement.entity';

type CreateGroupementData = Omit<CreateGroupementDto, 'initialAdmin'>;
type NormalizedCreateGroupementData = {
  address: string;
  city: string;
  code?: string;
  contactEmail: string;
  contactPhone: string;
  name: string;
  postalCode: string;
  serviceArea: string | null;
};

type NormalizedUpdateGroupementData = Partial<{
  address: string;
  city: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  name: string;
  postalCode: string;
  serviceArea: string | null;
  zoneColor: string;
  zoneLatitude: number | null;
  zoneLongitude: number | null;
  zonePolygonPoints: { lat: number; lng: number }[] | null;
  zoneRadiusMeters: number | null;
  zoneType: string | null;
}>;

/**
 * Service Groupements — logique métier de gestion des groupements.
 *
 * Ce module est le SEUL de la Vague 1 qui ne filtre PAS par groupement_id
 * car le groupement est l'objet des opérations, pas le filtre.
 * Toutes les opérations sont réservées au SUPER_ADMIN.
 * La table groupements N'A PAS de RLS.
 */
@Injectable()
export class GroupementsService {
  private readonly logger = new Logger(GroupementsService.name);

  constructor(
    @InjectRepository(Groupement)
    private readonly groupementRepo: Repository<Groupement>,
    @InjectRepository(GroupementSettings)
    private readonly settingsRepo: Repository<GroupementSettings>,
  ) {}

  // ── CREATE ────────────────────────────────────────────────

  /**
   * Crée un nouveau groupement avec ses settings par défaut.
   *
   * La création est atomique via une transaction TypeORM :
   * Groupement + GroupementSettings sont insérés ensemble.
   * Si l'une échoue, les deux sont rollback.
   *
   * Important : aucun admin n'est créé librement ici.
   * L'invitation obligatoire du premier admin est creee par le controller
   * apres creation du groupement.
   */
  async create(input: CreateGroupementData): Promise<Groupement> {
    const dto = normalizeCreateGroupementData(input);

    // Vérifier l'unicité du nom commercial
    const existingName = await this.findByName(dto.name);
    if (existingName) {
      throw new ConflictException(`Un groupement avec le nom "${dto.name}" existe déjà`);
    }

    const code = await this.resolveAvailableCode(dto.name, dto.code);

    // Transaction atomique : Groupement + Settings
    return this.groupementRepo.manager.transaction(async (manager) => {
      const groupement = manager.create(Groupement, {
        address: dto.address,
        city: dto.city,
        code,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        name: dto.name,
        postalCode: dto.postalCode,
        serviceArea: dto.serviceArea ?? null,
      });

      const savedGroupement = await manager.save(Groupement, groupement);

      const settings = manager.create(GroupementSettings, {
        groupementId: savedGroupement.id,
      });

      await manager.save(GroupementSettings, settings);

      this.logger.log({ groupementId: savedGroupement.id, name: dto.name }, 'Groupement created');

      // Reload avec les settings
      const result = await manager.findOne(Groupement, {
        relations: ['settings'],
        where: { id: savedGroupement.id },
      });

      return result!;
    });
  }

  // ── READ ──────────────────────────────────────────────────

  /**
   * Liste paginée des groupements avec filtrage par statut.
   * Pas de filtrage par groupement_id : SUPER_ADMIN voit tout.
   */
  async findAll(options: {
    page: number;
    limit: number;
    isActive?: boolean;
    search?: string;
  }): Promise<{ data: Groupement[]; total: number }> {
    const qb = this.groupementRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.settings', 'settings');

    if (options.isActive !== undefined) {
      qb.andWhere('g.isActive = :isActive', { isActive: options.isActive });
    }

    if (options.search) {
      qb.andWhere(
        `(
          g.name ILIKE :search
          OR g.code ILIKE :search
          OR g.city ILIKE :search
          OR g.contactEmail ILIKE :search
          OR g.serviceArea ILIKE :search
        )`,
        {
          search: `%${options.search}%`,
        },
      );
    }

    qb.orderBy('g.createdAt', 'DESC');
    qb.skip((options.page - 1) * options.limit);
    qb.take(options.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Retourne un groupement par son ID avec ses settings.
   * @throws NotFoundException si le groupement n'existe pas.
   */
  async findOne(id: string): Promise<Groupement> {
    const groupement = await this.groupementRepo.findOne({
      relations: ['settings'],
      where: { id },
    });

    if (!groupement) {
      throw new NotFoundException(`Groupement ${id} introuvable`);
    }

    return groupement;
  }

  // ── UPDATE ────────────────────────────────────────────────

  /** Met à jour partiellement un groupement. */
  async update(id: string, dto: UpdateGroupementDto): Promise<Groupement> {
    const groupement = await this.findOne(id);
    const updates = normalizeUpdateGroupementData(dto);

    // Vérifier l'unicité du nom si modifié
    if (updates.name && updates.name !== groupement.name) {
      const existing = await this.findByName(updates.name, id);
      if (existing) {
        throw new ConflictException(`Un groupement avec le nom "${updates.name}" existe déjà`);
      }
    }

    if (updates.code && updates.code !== groupement.code) {
      const existing = await this.findByCode(updates.code, id);
      if (existing) {
        throw new ConflictException(`Un groupement avec le code "${updates.code}" existe déjà`);
      }
      groupement.code = updates.code;
      delete updates.code;
    }

    // Appliquer les modifications
    Object.assign(groupement, updates);
    await this.groupementRepo.save(groupement);

    this.logger.log({ groupementId: id }, 'Groupement updated');

    return this.findOne(id);
  }

  /**
   * Met à jour les paramètres métier d'un groupement.
   * Endpoint dédié pour clarifier l'intention (vs. update de la fiche).
   */
  async updateSettings(
    groupementId: string,
    dto: UpdateGroupementSettingsDto,
  ): Promise<GroupementSettings> {
    const groupement = await this.findOne(groupementId);
    const settings =
      groupement.settings ??
      this.settingsRepo.create({
        groupementId,
      });

    Object.assign(settings, dto);
    const saved: GroupementSettings = await this.settingsRepo.save(settings);

    this.logger.log({ groupementId }, 'Groupement settings updated');

    return saved;
  }

  // ── SOFT DELETE ────────────────────────────────────────────

  /**
   * Désactive un groupement (soft delete).
   * Ne supprime JAMAIS physiquement — conserve les données historiques.
   * Les utilisateurs du groupement ne pourront plus se connecter.
   */
  async deactivate(id: string): Promise<Groupement> {
    const groupement = await this.findOne(id);

    if (!groupement.isActive) {
      throw new ConflictException(`Le groupement ${id} est déjà désactivé`);
    }

    groupement.isActive = false;
    const saved = await this.groupementRepo.save(groupement);

    this.logger.warn({ groupementId: id }, 'Groupement deactivated');

    return saved;
  }

  // ── HARD DELETE ────────────────────────────────────────────

  /**
   * Supprime définitivement un groupement.
   *
   * La suppression physique est volontairement stricte : PostgreSQL refuse
   * l'opération si des données métier existent encore (users, drivers,
   * clients, courses...). Dans ce cas, il faut désactiver le groupement.
   */
  async remove(id: string): Promise<Groupement> {
    const groupement = await this.findOne(id);

    try {
      await this.groupementRepo.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Impossible de supprimer définitivement ce groupement car des données métier y sont rattachées. Désactivez-le pour conserver l’historique.',
        );
      }

      throw error;
    }

    this.logger.warn({ groupementId: id }, 'Groupement permanently deleted');

    return groupement;
  }

  private async resolveAvailableCode(name: string, providedCode?: string): Promise<string> {
    if (providedCode) {
      const code = normalizeGroupementCode(providedCode);
      const existing = await this.findByCode(code);
      if (existing) {
        throw new ConflictException(`Un groupement avec le code "${code}" existe déjà`);
      }
      return code;
    }

    const baseCode = normalizeGroupementCode(name);

    for (let suffix = 1; suffix <= 99; suffix++) {
      const suffixText = suffix === 1 ? '' : `-${suffix}`;
      const candidate = `${baseCode.slice(0, 64 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
      const existing = await this.findByCode(candidate);

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException('Impossible de générer un code groupement unique');
  }

  private findByName(name: string, excludedId?: string): Promise<Groupement | null> {
    return this.groupementRepo.findOne({
      where: {
        ...(excludedId ? { id: Not(excludedId) } : {}),
        name: ILike(name),
      },
    });
  }

  private findByCode(code: string, excludedId?: string): Promise<Groupement | null> {
    return this.groupementRepo.findOne({
      where: {
        ...(excludedId ? { id: Not(excludedId) } : {}),
        code: ILike(code),
      },
    });
  }
}

function normalizeCreateGroupementData(dto: CreateGroupementData): NormalizedCreateGroupementData {
  return {
    address: normalizeRequiredText(dto.address, 'adresse'),
    city: normalizeRequiredText(dto.city, 'ville'),
    code: dto.code ? normalizeGroupementCode(dto.code) : undefined,
    contactEmail: normalizeEmail(dto.contactEmail),
    contactPhone: normalizeRequiredText(dto.contactPhone, 'téléphone de contact'),
    name: normalizeRequiredText(dto.name, 'nom commercial'),
    postalCode: normalizeRequiredText(dto.postalCode, 'code postal'),
    serviceArea: normalizeNullableText(dto.serviceArea),
  };
}

function normalizeUpdateGroupementData(dto: UpdateGroupementDto): NormalizedUpdateGroupementData {
  const updates: NormalizedUpdateGroupementData = {};

  if (dto.name !== undefined) updates.name = normalizeRequiredText(dto.name, 'nom commercial');
  if (dto.code !== undefined) updates.code = normalizeGroupementCode(dto.code);
  if (dto.address !== undefined) updates.address = normalizeRequiredText(dto.address, 'adresse');
  if (dto.postalCode !== undefined) {
    updates.postalCode = normalizeRequiredText(dto.postalCode, 'code postal');
  }
  if (dto.city !== undefined) updates.city = normalizeRequiredText(dto.city, 'ville');
  if (dto.contactEmail !== undefined) updates.contactEmail = normalizeEmail(dto.contactEmail);
  if (dto.contactPhone !== undefined) {
    updates.contactPhone = normalizeRequiredText(dto.contactPhone, 'téléphone de contact');
  }
  if (dto.serviceArea !== undefined) updates.serviceArea = normalizeNullableText(dto.serviceArea);
  if (dto.isActive !== undefined) updates.isActive = dto.isActive;

  // Zone geometry
  if (dto.zoneType !== undefined) updates.zoneType = dto.zoneType;
  if (dto.zoneLatitude !== undefined) updates.zoneLatitude = dto.zoneLatitude;
  if (dto.zoneLongitude !== undefined) updates.zoneLongitude = dto.zoneLongitude;
  if (dto.zoneRadiusMeters !== undefined) updates.zoneRadiusMeters = dto.zoneRadiusMeters;
  if (dto.zonePolygonPoints !== undefined) updates.zonePolygonPoints = dto.zonePolygonPoints;
  if (dto.zoneColor !== undefined) updates.zoneColor = dto.zoneColor;

  return updates;
}

function normalizeGroupementCode(value: string): string {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64)
    .replace(/-+$/g, '');

  if (!/^[A-Z0-9](?:[A-Z0-9-]{0,62}[A-Z0-9])?$/.test(normalized)) {
    throw new BadRequestException('Le code groupement est invalide');
  }

  return normalized;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(`Le champ ${label} est obligatoire`);
  }

  return normalized;
}

function normalizeNullableText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeEmail(value: string): string {
  return normalizeRequiredText(value, 'email de contact').toLowerCase();
}

function isForeignKeyViolation(error: unknown): boolean {
  const driverError = (error as { driverError?: { code?: string } }).driverError;
  return driverError?.code === '23503';
}
