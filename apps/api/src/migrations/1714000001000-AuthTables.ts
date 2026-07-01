import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : tables d'authentification (refresh_tokens).
 *
 * DETTE TECHNIQUE — FK conditionnelle :
 * La contrainte `fk_refresh_tokens_user_id` n'est créée que si la table `users`
 * existe déjà. Si cette migration est exécutée AVANT la migration du module Users,
 * la FK ne sera pas créée. Une migration corrective devra être ajoutée lors de
 * l'implémentation du module Users (Sprint 2) pour garantir l'intégrité référentielle.
 *
 * TODO: Créer une migration `AddRefreshTokensUserFk` dans le module Users.
 */
export class AuthTables1714000001000 implements MigrationInterface {
  name = 'AuthTables1714000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY,
        "token_hash" varchar(128) NOT NULL UNIQUE,
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_token_id" uuid,
        "reuse_detected_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_updated_at" timestamptz;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_refresh_tokens_user_id'
          ) THEN
            ALTER TABLE "refresh_tokens"
            ADD CONSTRAINT "fk_refresh_tokens_user_id"
            FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.refresh_tokens') IS NOT NULL THEN
          ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "fk_refresh_tokens_user_id";
        END IF;

        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE "users" DROP COLUMN IF EXISTS "password_updated_at";
          ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
