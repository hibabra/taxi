import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : tables users et user_invitations.
 *
 * Ces deux tables sont tenant-scoped et protégées par RLS. Les variables
 * `app.auth_lookup` et `app.invitation_lookup` ne sont activées que dans des
 * transactions applicatives très ciblées pour les flux login/invitation.
 */
export class UsersTables1714000005000 implements MigrationInterface {
  name = 'UsersTables1714000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id       uuid REFERENCES groupements(id) ON DELETE RESTRICT,
        first_name          varchar(128) NOT NULL,
        last_name           varchar(128) NOT NULL,
        email               varchar(254) NOT NULL,
        phone_e164          varchar(20),
        password_hash       text,
        password_updated_at timestamptz,
        roles               text[] NOT NULL DEFAULT ARRAY[]::text[],
        is_active           boolean NOT NULL DEFAULT true,
        last_login_at       timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_users_roles_non_empty CHECK (cardinality(roles) > 0),
        CONSTRAINT chk_users_roles_values CHECK (
          roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
        ),
        CONSTRAINT chk_users_phone_e164 CHECK (
          phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'
        )
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_groupement_email_unique
      ON users (groupement_id, lower(email))
      WHERE groupement_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_email_unique
      ON users (lower(email))
      WHERE groupement_id IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_groupement_id ON users (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING gin (roles);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id       uuid NOT NULL REFERENCES groupements(id) ON DELETE CASCADE,
        token_hash          varchar(64) NOT NULL UNIQUE,
        type                varchar(32) NOT NULL DEFAULT 'INVITATION',
        email               varchar(254) NOT NULL,
        first_name          varchar(128) NOT NULL,
        last_name           varchar(128) NOT NULL,
        phone_e164          varchar(20),
        roles               text[] NOT NULL DEFAULT ARRAY[]::text[],
        invited_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
        accepted_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
        expires_at          timestamptz NOT NULL,
        accepted_at         timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_user_invitations_type CHECK (type IN ('INVITATION', 'RESET_PASSWORD')),
        CONSTRAINT chk_user_invitations_roles_non_empty CHECK (cardinality(roles) > 0),
        CONSTRAINT chk_user_invitations_roles_values CHECK (
          roles <@ ARRAY['SUPER_ADMIN', 'ADMIN', 'DRIVER']::text[]
        ),
        CONSTRAINT chk_user_invitations_phone_e164 CHECK (
          phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'
        )
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_invitations_groupement_id
      ON user_invitations (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_invitations_email
      ON user_invitations (email);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at
      ON user_invitations (expires_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_invitations_groupement_email_type
      ON user_invitations (groupement_id, lower(email), type);
    `);

    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY users_tenant_isolation ON users
        FOR ALL
        USING (
          current_setting('app.auth_lookup', true) = 'on'
          OR current_setting('app.invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        )
        WITH CHECK (
          current_setting('app.auth_lookup', true) = 'on'
          OR current_setting('app.invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        );
    `);

    await queryRunner.query(`
      CREATE POLICY user_invitations_tenant_isolation ON user_invitations
        FOR ALL
        USING (
          current_setting('app.invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        )
        WITH CHECK (
          current_setting('app.invitation_lookup', true) = 'on'
          OR groupement_id = app_current_groupement_id()
        );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_refresh_tokens_user_id'
        ) THEN
          ALTER TABLE refresh_tokens
          ADD CONSTRAINT fk_refresh_tokens_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      COMMENT ON TABLE users
      IS 'Backoffice users scoped by groupement_id. Protected by RLS.';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE user_invitations
      IS 'One-time invitation and password-reset tokens stored hashed only.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS fk_refresh_tokens_user_id;
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS user_invitations_tenant_isolation ON user_invitations;
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS users_tenant_isolation ON users;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS user_invitations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}
