import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : table courses.
 *
 * Squelette Vague 1 uniquement : saisie manuelle, sans call_id,
 * sans GPS, sans WebSocket et sans modèle de paiement.
 */
export class CoursesTable1714000008000 implements MigrationInterface {
  name = 'CoursesTable1714000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id     uuid NOT NULL REFERENCES groupements(id) ON DELETE RESTRICT,
        client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
        driver_id         uuid NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
        pickup_address    text NOT NULL,
        dropoff_address   text NOT NULL,
        started_at        timestamptz NOT NULL,
        duration_minutes  integer NOT NULL,
        distance_km       numeric(8, 2) NOT NULL,
        amount_eur        numeric(10, 2),
        status            varchar(32) NOT NULL DEFAULT 'COMPLETED',
        note              text,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_courses_pickup_address_not_blank CHECK (length(trim(pickup_address)) > 0),
        CONSTRAINT chk_courses_dropoff_address_not_blank CHECK (length(trim(dropoff_address)) > 0),
        CONSTRAINT chk_courses_duration_minutes_non_negative CHECK (duration_minutes >= 0),
        CONSTRAINT chk_courses_distance_km_non_negative CHECK (distance_km >= 0),
        CONSTRAINT chk_courses_amount_eur_non_negative CHECK (
          amount_eur IS NULL OR amount_eur >= 0
        ),
        CONSTRAINT chk_courses_status CHECK (status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_groupement_id
      ON courses (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_groupement_started_at
      ON courses (groupement_id, started_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_groupement_driver_started_at
      ON courses (groupement_id, driver_id, started_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_groupement_client_started_at
      ON courses (groupement_id, client_id, started_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_groupement_status
      ON courses (groupement_id, status);
    `);

    await queryRunner.query(`ALTER TABLE courses ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE courses FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY courses_tenant_isolation ON courses
        FOR ALL
        USING (groupement_id = app_current_groupement_id())
        WITH CHECK (groupement_id = app_current_groupement_id());
    `);

    await queryRunner.query(`
      COMMENT ON TABLE courses
      IS 'Manual course entries scoped by groupement_id. V1 skeleton without calls, GPS, WebSocket or payment workflow.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN courses.amount_eur
      IS 'Optional fare amount for manual history. TaxiKiwi V1 does not manage payments or payment methods.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS courses_tenant_isolation ON courses;`);
    await queryRunner.query(`DROP TABLE IF EXISTS courses;`);
  }
}
