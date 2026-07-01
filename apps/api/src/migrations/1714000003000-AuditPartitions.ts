import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Table audit_logs partitionnée par mois.
 *
 * La table est :
 * - Partitionnée par RANGE sur created_at (1 partition = 1 mois)
 * - Append-only : droits UPDATE/DELETE révoqués pour le rôle applicatif
 * - Avec RLS activée pour l'isolation multi-tenant
 *
 * Le partitionnement permet :
 * - Des requêtes rapides sur une période donnée (partition pruning)
 * - L'archivage par DETACH PARTITION
 * - La purge RGPD par DROP PARTITION (Vague 4)
 */
export class AuditPartitions1714000003000 implements MigrationInterface {
  name = 'AuditPartitions1714000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Créer la table partitionnée par mois
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id              uuid DEFAULT gen_random_uuid(),
        groupement_id   uuid,
        user_id         uuid NOT NULL,
        action          varchar(64) NOT NULL,
        resource_type   varchar(64),
        resource_id     uuid,
        before          jsonb,
        after           jsonb,
        ip_address      inet,
        user_agent      varchar(512),
        request_id      varchar(64),
        created_at      timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at);
    `);

    // 2. Créer les partitions pour les 6 prochains mois
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const partitionName = `audit_logs_${start.getFullYear()}_${String(start.getMonth() + 1).padStart(2, '0')}`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF audit_logs
        FOR VALUES FROM ('${start.toISOString().slice(0, 10)}')
                     TO ('${end.toISOString().slice(0, 10)}');
      `);
    }

    // 3. Index pour les requêtes fréquentes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_groupement_created
      ON audit_logs (groupement_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
      ON audit_logs (user_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
      ON audit_logs (action, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
      ON audit_logs (resource_type, resource_id);
    `);

    // 4. Activer RLS pour l'isolation multi-tenant
    await queryRunner.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY audit_logs_tenant_isolation ON audit_logs
        FOR ALL
        USING (
          groupement_id IS NULL
          OR groupement_id = app_current_groupement_id()
        )
        WITH CHECK (
          groupement_id IS NULL
          OR groupement_id = app_current_groupement_id()
        );
    `);

    // 5. Commentaire documentaire
    await queryRunner.query(`
      COMMENT ON TABLE audit_logs
      IS 'Immutable audit trail. Partitioned by month. UPDATE and DELETE should be revoked for the application role in production.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;`);

    // Supprimer les partitions créées
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const partitionName = `audit_logs_${start.getFullYear()}_${String(start.getMonth() + 1).padStart(2, '0')}`;
      await queryRunner.query(`DROP TABLE IF EXISTS ${partitionName};`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
  }
}
