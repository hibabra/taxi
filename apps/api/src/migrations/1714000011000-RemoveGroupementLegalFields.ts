import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration corrective : la creation d'un groupement ne demande plus
 * d'identite legale. La fiche plateforme reste volontairement simple :
 * nom, code public, adresse, contact et premier admin invite.
 */
export class RemoveGroupementLegalFields1714000011000 implements MigrationInterface {
  name = 'RemoveGroupementLegalFields1714000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_groupements_siret;`);
    await queryRunner.query(`
      ALTER TABLE groupements
      DROP COLUMN IF EXISTS legal_name,
      DROP COLUMN IF EXISTS siret;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groupements_name_ci_unique
      ON groupements (lower(name));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_groupements_name_ci_unique;`);
    await queryRunner.query(`
      ALTER TABLE groupements
      ADD COLUMN IF NOT EXISTS legal_name varchar(256),
      ADD COLUMN IF NOT EXISTS siret char(14);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groupements_siret ON groupements (siret);
    `);
  }
}
