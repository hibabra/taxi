import { MigrationInterface, QueryRunner } from 'typeorm';

export class DriverAccountsAndGroupementLogin1714000009000 implements MigrationInterface {
  name = 'DriverAccountsAndGroupementLogin1714000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE groupements
      ADD COLUMN IF NOT EXISTS code varchar(64),
      ADD COLUMN IF NOT EXISTS driver_identifier_next integer NOT NULL DEFAULT 1;
    `);

    await queryRunner.query(`
      WITH normalized AS (
        SELECT
          id,
          COALESCE(
            NULLIF(
              trim(both '-' from regexp_replace(upper(name), '[^A-Z0-9]+', '-', 'g')),
              ''
            ),
            'GROUPEMENT-' || left(id::text, 8)
          ) AS base_code
        FROM groupements
        WHERE code IS NULL
      ),
      numbered AS (
        SELECT
          id,
          base_code,
          row_number() OVER (PARTITION BY base_code ORDER BY id) AS duplicate_rank
        FROM normalized
      )
      UPDATE groupements g
      SET code = CASE
        WHEN numbered.duplicate_rank = 1 THEN left(numbered.base_code, 64)
        ELSE left(numbered.base_code, 58) || '-' || numbered.duplicate_rank
      END
      FROM numbered
      WHERE g.id = numbered.id;
    `);

    await queryRunner.query(`
      ALTER TABLE groupements
      ALTER COLUMN code SET NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groupements_code_unique ON groupements (lower(code));
    `);

    await queryRunner.query(`
      UPDATE users
      SET roles = CASE
        WHEN cardinality(array_remove(roles, 'SUPERVISOR')) = 0 THEN ARRAY['DRIVER']::text[]
        ELSE array_remove(roles, 'SUPERVISOR')
      END
      WHERE 'SUPERVISOR' = ANY(roles);
    `);
    await queryRunner.query(`
      UPDATE user_invitations
      SET roles = CASE
        WHEN cardinality(array_remove(roles, 'SUPERVISOR')) = 0 THEN ARRAY['DRIVER']::text[]
        ELSE array_remove(roles, 'SUPERVISOR')
      END
      WHERE 'SUPERVISOR' = ANY(roles);
    `);

    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_roles_values;
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT chk_users_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
      );
    `);
    await queryRunner.query(`
      ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS chk_user_invitations_roles_values;
    `);
    await queryRunner.query(`
      ALTER TABLE user_invitations
      ADD CONSTRAINT chk_user_invitations_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
      );
    `);

    await queryRunner.query(`
      ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS driver_identifier varchar(16),
      ADD COLUMN IF NOT EXISTS license_city varchar(128),
      ADD COLUMN IF NOT EXISTS license_number varchar(64),
      ADD COLUMN IF NOT EXISTS is_group_admin boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS mobile_activated_at timestamptz;
    `);

    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          id,
          groupement_id,
          row_number() OVER (PARTITION BY groupement_id ORDER BY created_at, id) AS rank
        FROM drivers
        WHERE driver_identifier IS NULL
      )
      UPDATE drivers d
      SET driver_identifier = 'T' || numbered.rank
      FROM numbered
      WHERE d.id = numbered.id;
    `);

    await queryRunner.query(`
      WITH next_values AS (
        SELECT
          groupement_id,
          COALESCE(max(regexp_replace(driver_identifier, '^T', '')::integer), 0) + 1 AS next_value
        FROM drivers
        WHERE driver_identifier ~ '^T[0-9]+$'
        GROUP BY groupement_id
      )
      UPDATE groupements g
      SET driver_identifier_next = GREATEST(g.driver_identifier_next, next_values.next_value)
      FROM next_values
      WHERE g.id = next_values.groupement_id;
    `);

    await queryRunner.query(`
      ALTER TABLE drivers
      ALTER COLUMN driver_identifier SET NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE drivers DROP CONSTRAINT IF EXISTS chk_drivers_identifier_format;
    `);
    await queryRunner.query(`
      ALTER TABLE drivers
      ADD CONSTRAINT chk_drivers_identifier_format CHECK (driver_identifier ~ '^T[0-9]+$');
    `);
    await queryRunner.query(`
      ALTER TABLE drivers DROP CONSTRAINT IF EXISTS chk_drivers_matricule_format;
    `);
    await queryRunner.query(`
      ALTER TABLE drivers
      ADD CONSTRAINT chk_drivers_matricule_format CHECK (
        matricule ~ '^[A-Z]{2}-[0-9]{4,6}$' OR matricule ~ '^T[0-9]+$'
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_groupement_identifier_unique
      ON drivers (groupement_id, driver_identifier);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_one_group_admin
      ON drivers (groupement_id)
      WHERE is_group_admin = true;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_groupement_license_unique
      ON drivers (groupement_id, license_number)
      WHERE license_number IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS driver_invitations (
        id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id       uuid NOT NULL REFERENCES groupements(id) ON DELETE CASCADE,
        token_hash          varchar(64) NOT NULL UNIQUE,
        email               varchar(254) NOT NULL,
        license_city        varchar(128) NOT NULL,
        license_number      varchar(64) NOT NULL,
        invited_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
        accepted_driver_id  uuid REFERENCES drivers(id) ON DELETE SET NULL,
        is_group_admin      boolean NOT NULL DEFAULT false,
        expires_at          timestamptz NOT NULL,
        accepted_at         timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_invitations_groupement_id
      ON driver_invitations (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_invitations_email
      ON driver_invitations (email);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_invitations_expires_at
      ON driver_invitations (expires_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_invitations_groupement_email_active
      ON driver_invitations (groupement_id, lower(email))
      WHERE accepted_at IS NULL;
    `);

    await queryRunner.query(`ALTER TABLE driver_invitations ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE driver_invitations FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY driver_invitations_tenant_isolation ON driver_invitations
        FOR ALL
        USING (
          current_setting('app.driver_invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        )
        WITH CHECK (
          current_setting('app.driver_invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        );
    `);

    await queryRunner.query(`DROP POLICY IF EXISTS drivers_tenant_isolation ON drivers;`);
    await queryRunner.query(`
      CREATE POLICY drivers_tenant_isolation ON drivers
        FOR ALL
        USING (
          current_setting('app.auth_lookup', true) = 'on'
          OR current_setting('app.driver_invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        )
        WITH CHECK (
          current_setting('app.auth_lookup', true) = 'on'
          OR current_setting('app.driver_invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS driver_invitations_tenant_isolation ON driver_invitations;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS driver_invitations;`);
    await queryRunner.query(`DROP POLICY IF EXISTS drivers_tenant_isolation ON drivers;`);
    await queryRunner.query(`
      CREATE POLICY drivers_tenant_isolation ON drivers
        FOR ALL
        USING (groupement_id = app_current_groupement_id())
        WITH CHECK (groupement_id = app_current_groupement_id());
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_drivers_groupement_license_unique;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_drivers_one_group_admin;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_drivers_groupement_identifier_unique;`);
    await queryRunner.query(
      `ALTER TABLE drivers DROP CONSTRAINT IF EXISTS chk_drivers_identifier_format;`,
    );
    await queryRunner.query(
      `ALTER TABLE drivers DROP CONSTRAINT IF EXISTS chk_drivers_matricule_format;`,
    );
    await queryRunner.query(`
      ALTER TABLE drivers
      ADD CONSTRAINT chk_drivers_matricule_format CHECK (matricule ~ '^[A-Z]{2}-[0-9]{4,6}$');
    `);
    await queryRunner.query(`
      ALTER TABLE drivers
      DROP COLUMN IF EXISTS mobile_activated_at,
      DROP COLUMN IF EXISTS is_group_admin,
      DROP COLUMN IF EXISTS license_number,
      DROP COLUMN IF EXISTS license_city,
      DROP COLUMN IF EXISTS driver_identifier;
    `);
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_roles_values;`);
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT chk_users_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'DISPATCHER', 'SUPERVISOR']::text[]
      );
    `);
    await queryRunner.query(
      `ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS chk_user_invitations_roles_values;`,
    );
    await queryRunner.query(`
      ALTER TABLE user_invitations
      ADD CONSTRAINT chk_user_invitations_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'DISPATCHER', 'SUPERVISOR']::text[]
      );
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_groupements_code_unique;`);
    await queryRunner.query(`
      ALTER TABLE groupements
      DROP COLUMN IF EXISTS driver_identifier_next,
      DROP COLUMN IF EXISTS code;
    `);
  }
}
