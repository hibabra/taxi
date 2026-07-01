import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDriverPositionsTable1778618595797 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer le type enum pour le statut de disponibilité
    await queryRunner.query(`
      CREATE TYPE "driver_availability_status_enum" AS ENUM (
        'LIBRE',
        'COURSE',
        'ABSENT',
        'HORS_SERVICE',
        'STATION'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "driver_positions" (
        "id"            uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "groupement_id" uuid          NOT NULL,
        "driver_id"     uuid          NOT NULL,
        "latitude"      numeric(10,7) NOT NULL,
        "longitude"     numeric(10,7) NOT NULL,
        "accuracy"      numeric(8,2),
        "speed"         numeric(8,2),
        "heading"       numeric(6,2),
        "status"        "driver_availability_status_enum",
        "recorded_at"   TIMESTAMP     NOT NULL DEFAULT now(),

        CONSTRAINT "PK_driver_positions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_driver_positions_groupement_id"
      ON "driver_positions" ("groupement_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_driver_positions_driver_id"
      ON "driver_positions" ("driver_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_driver_positions_driver_id"`);
    await queryRunner.query(`DROP INDEX "IDX_driver_positions_groupement_id"`);
    await queryRunner.query(`DROP TABLE "driver_positions"`);
    await queryRunner.query(`DROP TYPE "driver_availability_status_enum"`);
  }
}
