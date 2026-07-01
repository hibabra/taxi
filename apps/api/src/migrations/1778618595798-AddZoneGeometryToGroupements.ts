import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Ajoute les champs de géométrie de zone au groupement.
 *
 * Chaque groupement possède une seule zone géographique (CIRCLE ou POLYGON).
 * On réutilise le même enum `stations_type_enum` déjà créé par la migration stations.
 */
export class AddZoneGeometryToGroupements1778618595798 implements MigrationInterface {
  name = 'AddZoneGeometryToGroupements1778618595798';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groupements"
        ADD COLUMN "zone_type"           "stations_type_enum"  DEFAULT NULL,
        ADD COLUMN "zone_latitude"       numeric(10,7)         DEFAULT NULL,
        ADD COLUMN "zone_longitude"      numeric(10,7)         DEFAULT NULL,
        ADD COLUMN "zone_radius_meters"  integer               DEFAULT NULL,
        ADD COLUMN "zone_polygon_points" jsonb                 DEFAULT NULL,
        ADD COLUMN "zone_color"          varchar(7)            NOT NULL DEFAULT '#3b82f6'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "groupements"."zone_type"
      IS 'Type géométrique de la zone du groupement : CIRCLE ou POLYGON. NULL = zone non définie.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groupements"
        DROP COLUMN IF EXISTS "zone_color",
        DROP COLUMN IF EXISTS "zone_polygon_points",
        DROP COLUMN IF EXISTS "zone_radius_meters",
        DROP COLUMN IF EXISTS "zone_longitude",
        DROP COLUMN IF EXISTS "zone_latitude",
        DROP COLUMN IF EXISTS "zone_type"
    `);
  }
}
