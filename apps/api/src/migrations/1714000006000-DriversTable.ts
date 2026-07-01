import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : table drivers.
 *
 * Table tenant-scoped protégée par RLS. Le matricule est unique par
 * groupement et le lien user_id est nullable mais unique.
 */
export class DriversTable1714000006000 implements MigrationInterface {
  name = 'DriversTable1714000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id         uuid NOT NULL REFERENCES groupements(id) ON DELETE RESTRICT,
        user_id               uuid REFERENCES users(id) ON DELETE SET NULL,
        first_name            varchar(128) NOT NULL,
        last_name             varchar(128) NOT NULL,
        matricule             varchar(16) NOT NULL,
        phone_e164            varchar(20) NOT NULL,
        joined_at             timestamptz NOT NULL DEFAULT now(),
        vehicle_make          varchar(64) NOT NULL,
        vehicle_model         varchar(64) NOT NULL,
        vehicle_registration  varchar(32) NOT NULL,
        vehicle_year          integer NOT NULL,
        status                varchar(32) NOT NULL DEFAULT 'ACTIVE',
        status_reason         varchar(512),
        status_changed_at     timestamptz NOT NULL DEFAULT now(),
        suspended_at          timestamptz,
        offboarded_at         timestamptz,
        created_at            timestamptz NOT NULL DEFAULT now(),
        updated_at            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_drivers_matricule_format CHECK (matricule ~ '^[A-Z]{2}-[0-9]{4,6}$'),
        CONSTRAINT chk_drivers_phone_e164 CHECK (phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'),
        CONSTRAINT chk_drivers_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'OFFBOARDED')),
        CONSTRAINT chk_drivers_vehicle_year CHECK (vehicle_year BETWEEN 1980 AND 2100),
        CONSTRAINT chk_drivers_offboarded_at CHECK (
          (status = 'OFFBOARDED' AND offboarded_at IS NOT NULL)
          OR status <> 'OFFBOARDED'
        )
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_groupement_matricule_unique
      ON drivers (groupement_id, matricule);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id_unique
      ON drivers (user_id)
      WHERE user_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_drivers_groupement_id
      ON drivers (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_drivers_status
      ON drivers (status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_drivers_phone_e164
      ON drivers (groupement_id, phone_e164);
    `);

    await queryRunner.query(`ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE drivers FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY drivers_tenant_isolation ON drivers
        FOR ALL
        USING (groupement_id = app_current_groupement_id())
        WITH CHECK (groupement_id = app_current_groupement_id());
    `);

    await queryRunner.query(`
      COMMENT ON TABLE drivers
      IS 'Drivers scoped by groupement_id. Protected by RLS. OFFBOARDED is final at API level.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS drivers_tenant_isolation ON drivers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS drivers;`);
  }
}
