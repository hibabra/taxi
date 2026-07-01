import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration corrective : le backoffice n'utilise plus le role DISPATCHER.
 *
 * Les comptes et invitations existants avec DISPATCHER sont transformes
 * en ADMIN de groupement avant de resserrer les contraintes SQL.
 */
export class RemoveDispatcherRole1714000010000 implements MigrationInterface {
  name = 'RemoveDispatcherRole1714000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET roles = normalized.roles
      FROM (
        SELECT
          id,
          COALESCE(
            NULLIF(
              ARRAY(
                SELECT DISTINCT CASE
                  WHEN role IN ('DISPATCHER', 'SUPERVISOR') THEN 'ADMIN'
                  ELSE role
                END
                FROM unnest(roles) AS role
                WHERE role = ANY(ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'DISPATCHER', 'SUPERVISOR']::text[])
              ),
              ARRAY[]::text[]
            ),
            ARRAY['ADMIN']::text[]
          ) AS roles
        FROM users
      ) normalized
      WHERE users.id = normalized.id
        AND users.roles IS DISTINCT FROM normalized.roles;
    `);

    await queryRunner.query(`
      UPDATE user_invitations
      SET roles = normalized.roles
      FROM (
        SELECT
          id,
          COALESCE(
            NULLIF(
              ARRAY(
                SELECT DISTINCT CASE
                  WHEN role IN ('DISPATCHER', 'SUPERVISOR') THEN 'ADMIN'
                  ELSE role
                END
                FROM unnest(roles) AS role
                WHERE role = ANY(ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'DISPATCHER', 'SUPERVISOR']::text[])
              ),
              ARRAY[]::text[]
            ),
            ARRAY['ADMIN']::text[]
          ) AS roles
        FROM user_invitations
      ) normalized
      WHERE user_invitations.id = normalized.id
        AND user_invitations.roles IS DISTINCT FROM normalized.roles;
    `);

    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_roles_values;`);
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT chk_users_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
      );
    `);

    await queryRunner.query(
      `ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS chk_user_invitations_roles_values;`,
    );
    await queryRunner.query(`
      ALTER TABLE user_invitations
      ADD CONSTRAINT chk_user_invitations_roles_values CHECK (
        roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
      );
    `);

    await queryRunner.query(`
      ALTER TABLE driver_invitations
      ADD COLUMN IF NOT EXISTS is_group_admin boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(`
      ALTER TABLE driver_invitations
      DROP COLUMN IF EXISTS is_group_admin;
    `);
  }
}
