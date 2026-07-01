import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entrée du journal d'audit.
 *
 * Table append-only : jamais d'UPDATE ni de DELETE applicatif.
 * Partitionnée par mois dans la migration pour des performances
 * optimales sur les requêtes par période.
 *
 * Les droits UPDATE/DELETE sont révoqués au niveau PostgreSQL
 * pour le rôle applicatif.
 */
@Entity('audit_logs')
@Index(['groupementId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['resourceType', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * UUID du groupement — pour RLS et filtrage.
   * Nullable pour les actions SUPER_ADMIN hors tenant
   * (ex: création d'un groupement).
   */
  @Column({ type: 'uuid', name: 'groupement_id', nullable: true })
  groupementId!: string | null;

  /** UUID de l'utilisateur qui a effectué l'action. */
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  /**
   * Code d'action standardisé.
   * Doit correspondre à une valeur de AuditAction
   * dans packages/shared-config/src/audit-actions.ts.
   */
  @Column({ type: 'varchar', length: 64 })
  action!: string;

  /** Type de la ressource cible (ex: 'User', 'Driver', 'Client'). */
  @Column({ type: 'varchar', length: 64, name: 'resource_type', nullable: true })
  resourceType!: string | null;

  /** UUID de la ressource cible. */
  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId!: string | null;

  /** État de la ressource AVANT l'action (null pour les créations). */
  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  /** État de la ressource APRÈS l'action (null pour les suppressions). */
  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  /** Adresse IP du client HTTP. */
  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  /** User-Agent du client HTTP. */
  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  /** ID de requête pino pour le traçage cross-référencé. */
  @Column({ type: 'varchar', length: 64, name: 'request_id', nullable: true })
  requestId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
