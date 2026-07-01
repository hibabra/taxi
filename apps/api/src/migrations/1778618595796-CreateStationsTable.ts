import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStationsTable1778618595796 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer le type enum pour le type de station
    await queryRunner.query(`
      CREATE TYPE "stations_type_enum" AS ENUM ('CIRCLE', 'POLYGON')
    `);

    await queryRunner.query(`
      CREATE TABLE "stations" (
        "id"              uuid                      NOT NULL DEFAULT uuid_generate_v4(),
        "groupement_id"   uuid                      NOT NULL,
        "name"            character varying(100)    NOT NULL,
        "description"     text,
        "address"         character varying(255),

        -- Type de zone : cercle ou polygone
        "type"            "stations_type_enum"      NOT NULL DEFAULT 'CIRCLE',

        -- Champs CIRCLE
        "latitude"        numeric(10,7),
        "longitude"       numeric(10,7),
        "radius_meters"   integer,

        -- Champs POLYGON
        "polygon_points"  jsonb,

        "is_active"       boolean                   NOT NULL DEFAULT true,
        "created_at"      TIMESTAMP                 NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP                 NOT NULL DEFAULT now(),

        CONSTRAINT "PK_stations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stations_groupement_id"
      ON "stations" ("groupement_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_stations_groupement_id"`);
    await queryRunner.query(`DROP TABLE "stations"`);
    await queryRunner.query(`DROP TYPE "stations_type_enum"`);
  }
}
