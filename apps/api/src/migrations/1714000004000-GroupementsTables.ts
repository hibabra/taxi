import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Tables groupements et groupement_settings.
 *
 * La table groupements N'A PAS de RLS car le groupement est l'objet
 * des opérations, pas le filtre. Toutes les opérations sont
 * réservées au SUPER_ADMIN au niveau applicatif.
 */
export class GroupementsTables1714000004000 implements MigrationInterface {
  name = 'GroupementsTables1714000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultServiceHours = {
      friday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      monday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      saturday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      sunday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      thursday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      tuesday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
      wednesday: { closeTime: '22:00', isOpen: true, openTime: '06:00' },
    };

    // 1. Table groupements
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS groupements (
        id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name            varchar(128) NOT NULL UNIQUE,
        address         varchar(512) NOT NULL,
        postal_code     varchar(10) NOT NULL,
        city            varchar(128) NOT NULL,
        contact_email   varchar(256) NOT NULL,
        contact_phone   varchar(20) NOT NULL,
        service_area    text,
        is_active       boolean NOT NULL DEFAULT true,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Table groupement_settings (one-to-one)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS groupement_settings (
        id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id         uuid NOT NULL UNIQUE
                              REFERENCES groupements(id) ON DELETE CASCADE,
        ring_timeout_seconds  int NOT NULL DEFAULT 30,
        dispatch_policy       varchar(32) NOT NULL DEFAULT 'STATION_FIRST',
        service_hours         jsonb NOT NULL DEFAULT '${JSON.stringify(defaultServiceHours)}',
        gdpr_notice           text NOT NULL DEFAULT '',
        logo_url              varchar(512),
        primary_color         varchar(7) NOT NULL DEFAULT '#22C55E'
      );
    `);

    // 3. Index d'unicité insensible à la casse pour éviter les doublons visuels.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groupements_name_ci_unique
      ON groupements (lower(name));
    `);

    // 4. Index pour recherche par statut
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_groupements_active ON groupements (is_active);
    `);

    // 5. Commentaires documentaires
    await queryRunner.query(`
      COMMENT ON TABLE groupements
      IS 'Table maîtresse des groupements de taxis. PAS de RLS — toutes les opérations sont SUPER_ADMIN.';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE groupement_settings
      IS 'Paramètres métier configurables par groupement. One-to-one avec groupements.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS groupement_settings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS groupements;`);
  }
}
