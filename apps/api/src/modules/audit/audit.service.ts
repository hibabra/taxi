import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TenantContext } from '../tenancy/tenant-context';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuditLog } from './entities/audit-log.entity';

/**
 * Champs sensibles exclus de la capture before/after.
 * Ne JAMAIS stocker de secrets dans le journal d'audit.
 */
const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  'password_hash',
  'tokenHash',
  'token_hash',
  'refreshToken',
  'accessToken',
  'secret',
  'cookie',
]);

export interface AuditLogEntry {
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  /** Override explicite du userId (pour les actions auth). */
  userId?: string;
  /** Override explicite du groupementId. */
  groupementId?: string | null;
}

export type AuditLogListItem = AuditLog & {
  actorEmail: string | null;
  actorName: string | null;
  groupementCode: string | null;
  groupementName: string | null;
};

/**
 * Service d'audit — append-only.
 *
 * Ce service n'expose JAMAIS de méthode update ou delete.
 * L'immuabilité est garantie au niveau applicatif ET au
 * niveau PostgreSQL (droits UPDATE/DELETE révoqués).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly tenancyService: TenancyService,
  ) {}

  /**
   * Enregistre une entrée dans le journal d'audit.
   *
   * Les champs sensibles (passwordHash, tokens, etc.)
   * sont automatiquement supprimés des captures before/after.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const tenant = TenantContext.getOrNull();

      const auditLog = this.auditLogRepository.create({
        action: entry.action,
        after: entry.after ? this.sanitize(entry.after) : null,
        before: entry.before ? this.sanitize(entry.before) : null,
        groupementId: entry.groupementId ?? tenant?.groupementId ?? null,
        ipAddress: entry.ipAddress ?? null,
        requestId: entry.requestId ?? null,
        resourceId: entry.resourceId ?? null,
        resourceType: entry.resourceType ?? null,
        userAgent: entry.userAgent ?? null,
        userId: entry.userId ?? tenant?.userId ?? '00000000-0000-0000-0000-000000000000',
      });

      await this.auditLogRepository.save(auditLog);

      this.logger.debug(
        {
          action: entry.action,
          resourceId: entry.resourceId,
          resourceType: entry.resourceType,
        },
        'Audit log entry created',
      );
    } catch (error: unknown) {
      // L'audit ne doit JAMAIS bloquer le flux métier.
      // On log l'erreur mais on ne la propage pas.
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log entry');
    }
  }

  /**
   * Récupère les entrées d'audit avec pagination et filtres.
   * Réservé au SUPER_ADMIN.
   */
  async findAll(options: {
    page: number;
    limit: number;
    action?: string;
    userId?: string;
    groupementId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: AuditLogListItem[]; total: number }> {
    return this.tenancyService.withTenantTransaction(async (queryRunner) => {
      await queryRunner.query(`SET LOCAL app.auth_lookup = 'on'`);
      const qb = queryRunner.manager.getRepository(AuditLog).createQueryBuilder('audit');

      qb.leftJoin('users', 'actor', 'actor.id = audit.user_id');
      qb.leftJoin('groupements', 'groupement', 'groupement.id = audit.groupement_id');
      qb.addSelect('actor.first_name', 'actor_first_name');
      qb.addSelect('actor.last_name', 'actor_last_name');
      qb.addSelect('actor.email', 'actor_email');
      qb.addSelect('groupement.name', 'groupement_name');
      qb.addSelect('groupement.code', 'groupement_code');

      if (options.action) {
        qb.andWhere('audit.action = :action', { action: options.action });
      }

      if (options.userId) {
        qb.andWhere('audit.userId = :userId', { userId: options.userId });
      }

      if (options.groupementId) {
        qb.andWhere('audit.groupementId = :groupementId', {
          groupementId: options.groupementId,
        });
      }

      if (options.startDate) {
        qb.andWhere('audit.createdAt >= :startDate', { startDate: options.startDate });
      }

      if (options.endDate) {
        qb.andWhere('audit.createdAt <= :endDate', { endDate: options.endDate });
      }

      const total = await qb.getCount();

      qb.orderBy('audit.createdAt', 'DESC');
      qb.skip((options.page - 1) * options.limit);
      qb.take(options.limit);

      const result = await qb.getRawAndEntities();

      const data = result.entities.map((entry, index) => {
        const raw = result.raw[index] as AuditLogRawJoin | undefined;
        return Object.assign(entry, {
          actorEmail: raw?.actor_email ?? null,
          actorName: formatActorName(raw?.actor_first_name, raw?.actor_last_name),
          groupementCode: raw?.groupement_code ?? null,
          groupementName: raw?.groupement_name ?? null,
        });
      });

      return { data, total };
    });
  }

  /**
   * Supprime les champs sensibles d'un objet pour le journal d'audit.
   * Ne JAMAIS stocker de secrets (password hashes, tokens) dans les logs.
   */
  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

type AuditLogRawJoin = {
  actor_email?: string | null;
  actor_first_name?: string | null;
  actor_last_name?: string | null;
  groupement_code?: string | null;
  groupement_name?: string | null;
};

function formatActorName(firstName?: string | null, lastName?: string | null): string | null {
  const name = [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

  return name || null;
}
