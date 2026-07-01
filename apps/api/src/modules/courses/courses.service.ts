import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { Client } from '../clients/entities/client.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import { COURSE_CREATED, COURSE_DELETED, COURSE_UPDATED } from './courses.constants';
import { CourseResponseDto } from './dto/course-response.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course } from './entities/course.entity';
import { CourseStatus } from './types/course-status.enum';

export interface ListCoursesOptions {
  clientId?: string;
  driverId?: string;
  limit: number;
  page: number;
  startedFrom?: Date;
  startedTo?: Date;
  status?: CourseStatus;
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    groupementId: string,
    options: ListCoursesOptions,
  ): Promise<{ data: CourseResponseDto[]; total: number }> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const qb = queryRunner.manager
        .getRepository(Course)
        .createQueryBuilder('c')
        .where('c.groupement_id = :groupementId', { groupementId });

      if (options.startedFrom) {
        qb.andWhere('c.started_at >= :startedFrom', { startedFrom: options.startedFrom });
      }

      if (options.startedTo) {
        qb.andWhere('c.started_at <= :startedTo', { startedTo: options.startedTo });
      }

      if (options.driverId) {
        qb.andWhere('c.driver_id = :driverId', { driverId: options.driverId });
      }

      if (options.clientId) {
        qb.andWhere('c.client_id = :clientId', { clientId: options.clientId });
      }

      if (options.status) {
        qb.andWhere('c.status = :status', { status: options.status });
      }

      qb.orderBy('c.started_at', 'DESC')
        .addOrderBy('c.created_at', 'DESC')
        .skip((options.page - 1) * options.limit)
        .take(options.limit);

      const [data, total] = await qb.getManyAndCount();

      return { data: data.map(serializeCourse), total };
    });
  }

  async findOne(id: string, groupementId: string): Promise<CourseResponseDto> {
    const course = await this.tenancyService.withTenantTransaction((queryRunner) =>
      this.findCourseOrFailInManager(queryRunner.manager, id, groupementId),
    );

    return serializeCourse(course);
  }

  async create(groupementId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      await this.assertDriverBelongsToGroupement(manager, groupementId, dto.driverId);

      if (dto.clientId) {
        await this.assertClientBelongsToGroupement(manager, groupementId, dto.clientId);
      }

      const createdCourse = manager.getRepository(Course).create({
        amountEur: dto.amountEur ?? null,
        clientId: dto.clientId ?? null,
        distanceKm: dto.distanceKm,
        driverId: dto.driverId,
        dropoffAddress: normalizeRequiredText(dto.dropoffAddress, 'adresse d’arrivée'),
        durationMinutes: dto.durationMinutes,
        groupementId,
        note: normalizeNullableText(dto.note),
        pickupAddress: normalizeRequiredText(dto.pickupAddress, 'adresse de départ'),
        startedAt: dto.startedAt,
        status: dto.status ?? CourseStatus.COMPLETED,
      });

      return manager.getRepository(Course).save(createdCourse);
    });

    await this.auditService.log({
      action: COURSE_CREATED,
      after: auditSnapshot(course),
      groupementId,
      resourceId: course.id,
      resourceType: 'Course',
    });

    this.logger.log({ courseId: course.id, groupementId }, 'Course created manually');
    return serializeCourse(course);
  }

  async update(id: string, groupementId: string, dto: UpdateCourseDto): Promise<CourseResponseDto> {
    const { after, before } = await this.tenancyService.withTenantTransaction(
      async (queryRunner) => {
        const manager = queryRunner.manager;
        const repository = manager.getRepository(Course);
        const target = await this.findCourseOrFailInManager(manager, id, groupementId);
        const before = auditSnapshot(target);

        if (dto.driverId !== undefined && dto.driverId !== target.driverId) {
          await this.assertDriverBelongsToGroupement(manager, groupementId, dto.driverId);
          target.driverId = dto.driverId;
        }

        if (dto.clientId !== undefined && dto.clientId !== target.clientId) {
          if (dto.clientId !== null) {
            await this.assertClientBelongsToGroupement(manager, groupementId, dto.clientId);
          }
          target.clientId = dto.clientId;
        }

        if (dto.pickupAddress !== undefined) {
          target.pickupAddress = normalizeRequiredText(dto.pickupAddress, 'adresse de départ');
        }
        if (dto.dropoffAddress !== undefined) {
          target.dropoffAddress = normalizeRequiredText(dto.dropoffAddress, 'adresse d’arrivée');
        }
        if (dto.startedAt !== undefined) target.startedAt = dto.startedAt;
        if (dto.durationMinutes !== undefined) target.durationMinutes = dto.durationMinutes;
        if (dto.distanceKm !== undefined) target.distanceKm = dto.distanceKm;
        if (dto.amountEur !== undefined) target.amountEur = dto.amountEur;
        if (dto.status !== undefined) target.status = dto.status;
        if (dto.note !== undefined) target.note = normalizeNullableText(dto.note);

        const after = await repository.save(target);
        return { after, before };
      },
    );

    await this.auditService.log({
      action: COURSE_UPDATED,
      after: auditSnapshot(after),
      before,
      groupementId,
      resourceId: id,
      resourceType: 'Course',
    });

    this.logger.log({ courseId: id, groupementId }, 'Course updated');
    return serializeCourse(after);
  }

  /**
   * Supprime physiquement une course.
   *
   * TODO(wave-2): Remplacer par un soft-delete avec `deletedAt: Date | null`.
   * Nécessite :
   * 1. Ajouter une colonne `deleted_at TIMESTAMPTZ` via migration
   * 2. Ajouter `@DeleteDateColumn()` à l'entité Course
   * 3. Remplacer `remove()` par `softRemove()` ou un update `deletedAt = now()`
   * 4. Filtrer les courses supprimées dans `findAll()` par défaut
   *
   * Le hard-delete actuel est acceptable en Vague 1 car les données
   * sont capturées dans l'audit log (before snapshot) avant suppression.
   */
  async delete(id: string, groupementId: string): Promise<CourseResponseDto> {
    const deleted = await this.tenancyService.withTenantTransaction(async (queryRunner) => {
      const manager = queryRunner.manager;
      const target = await this.findCourseOrFailInManager(manager, id, groupementId);
      await manager.getRepository(Course).remove(target);
      return target;
    });

    await this.auditService.log({
      action: COURSE_DELETED,
      before: auditSnapshot(deleted),
      groupementId,
      resourceId: id,
      resourceType: 'Course',
    });

    this.logger.warn({ courseId: id, groupementId }, 'Course deleted');
    return serializeCourse(deleted);
  }

  private async findCourseOrFailInManager(
    manager: EntityManager,
    id: string,
    groupementId: string,
  ): Promise<Course> {
    const course = await manager.getRepository(Course).findOne({
      where: { groupementId, id },
    });

    if (!course) {
      throw new NotFoundException(`Course ${id} introuvable`);
    }

    return course;
  }

  private async assertDriverBelongsToGroupement(
    manager: EntityManager,
    groupementId: string,
    driverId: string,
  ): Promise<void> {
    const driver = await manager.getRepository(Driver).findOne({
      where: { groupementId, id: driverId },
    });

    if (!driver) {
      throw new BadRequestException("Le chauffeur indiqué n'existe pas dans ce groupement");
    }
  }

  private async assertClientBelongsToGroupement(
    manager: EntityManager,
    groupementId: string,
    clientId: string,
  ): Promise<void> {
    const client = await manager.getRepository(Client).findOne({
      where: { groupementId, id: clientId },
    });

    if (!client) {
      throw new BadRequestException("Le client indiqué n'existe pas dans ce groupement");
    }
  }
}

function serializeCourse(course: Course): CourseResponseDto {
  return {
    amountEur: course.amountEur,
    clientId: course.clientId,
    createdAt: course.createdAt,
    distanceKm: course.distanceKm,
    driverId: course.driverId,
    dropoffAddress: course.dropoffAddress,
    durationMinutes: course.durationMinutes,
    groupementId: course.groupementId,
    id: course.id,
    note: course.note,
    pickupAddress: course.pickupAddress,
    startedAt: course.startedAt,
    status: course.status,
    updatedAt: course.updatedAt,
  };
}

function auditSnapshot(course: Course): Record<string, unknown> {
  return {
    amountEur: course.amountEur,
    clientId: course.clientId,
    distanceKm: course.distanceKm,
    driverId: course.driverId,
    dropoffAddress: course.dropoffAddress,
    durationMinutes: course.durationMinutes,
    id: course.id,
    note: course.note,
    pickupAddress: course.pickupAddress,
    startedAt: course.startedAt,
    status: course.status,
  };
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`Le champ ${label} est obligatoire`);
  }
  return normalized;
}

function normalizeNullableText(value: null | string | undefined): null | string {
  if (value === undefined || value === null) {
    return null;
  }

  return value.trim() || null;
}
