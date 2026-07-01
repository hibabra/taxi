import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Infrastructure Row-Level Security.
 *
 * Crée le mécanisme de sécurité multi-tenant au niveau PostgreSQL.
 * La variable `app.current_groupement_id` est positionnée par le
 * TenancyService au début de chaque requête/transaction.
 *
 * NOTE : Cette migration crée l'infrastructure RLS mais n'active
 * pas encore RLS sur des tables spécifiques (les tables métier
 * n'existent pas encore). Chaque module métier activera RLS
 * sur sa propre table dans sa migration de création.
 */
export class RlsPolicies1714000002000 implements MigrationInterface {
  name = 'RlsPolicies1714000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Créer la variable de session si elle n'existe pas
    // SET LOCAL ne nécessite pas de déclaration préalable dans PostgreSQL,
    // mais on crée un helper pour la lecture sûre.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_current_groupement_id()
      RETURNS uuid AS $$
      BEGIN
        RETURN current_setting('app.current_groupement_id', true)::uuid;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // 2. Commentaire documentaire
    await queryRunner.query(`
      COMMENT ON FUNCTION app_current_groupement_id()
      IS 'Returns the current tenant groupement_id from the session variable. Used by RLS policies. Returns NULL if not set.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_current_groupement_id();`);
  }
}
