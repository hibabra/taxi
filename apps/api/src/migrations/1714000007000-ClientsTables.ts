import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : tables clients et client_addresses.
 *
 * Les deux tables sont tenant-scoped et protégées par RLS. Le téléphone
 * E.164 est indexé en B-tree pour la recherche rapide par appel entrant.
 */
export class ClientsTables1714000007000 implements MigrationInterface {
  name = 'ClientsTables1714000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id               uuid NOT NULL REFERENCES groupements(id) ON DELETE RESTRICT,
        full_name                   varchar(256) NOT NULL,
        gender                      varchar(32),
        email                       varchar(254),
        phone_e164                  varchar(20) NOT NULL,
        is_blacklisted              boolean NOT NULL DEFAULT false,
        blacklist_reason            varchar(512),
        notes                       text,
        anonymization_requested_at  timestamptz,
        archived_at                 timestamptz,
        created_at                  timestamptz NOT NULL DEFAULT now(),
        updated_at                  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_clients_phone_e164 CHECK (phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'),
        CONSTRAINT chk_clients_blacklist_reason CHECK (
          is_blacklisted = false
          OR (blacklist_reason IS NOT NULL AND length(trim(blacklist_reason)) > 0)
        )
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_groupement_phone_unique
      ON clients (groupement_id, phone_e164);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_phone_e164
      ON clients (phone_e164);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_groupement_id
      ON clients (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_blacklisted
      ON clients (groupement_id, is_blacklisted);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_archived_at
      ON clients (groupement_id, archived_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_full_name
      ON clients (groupement_id, full_name);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_addresses (
        id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        groupement_id  uuid NOT NULL REFERENCES groupements(id) ON DELETE RESTRICT,
        client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        label          varchar(128) NOT NULL,
        address_line1  varchar(512) NOT NULL,
        address_line2  varchar(512),
        postal_code    varchar(16) NOT NULL,
        city           varchar(128) NOT NULL,
        country_code   char(2) NOT NULL DEFAULT 'FR',
        is_default     boolean NOT NULL DEFAULT false,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_client_addresses_country_code CHECK (country_code ~ '^[A-Z]{2}$')
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_addresses_groupement_id
      ON client_addresses (groupement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id
      ON client_addresses (client_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_addresses_one_default
      ON client_addresses (groupement_id, client_id)
      WHERE is_default = true;
    `);

    await queryRunner.query(`ALTER TABLE clients ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE clients FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE client_addresses FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY clients_tenant_isolation ON clients
        FOR ALL
        USING (groupement_id = app_current_groupement_id())
        WITH CHECK (groupement_id = app_current_groupement_id());
    `);

    await queryRunner.query(`
      CREATE POLICY client_addresses_tenant_isolation ON client_addresses
        FOR ALL
        USING (groupement_id = app_current_groupement_id())
        WITH CHECK (groupement_id = app_current_groupement_id());
    `);

    await queryRunner.query(`
      COMMENT ON TABLE clients
      IS 'Customer records scoped by groupement_id. Phone is normalized E.164 and indexed for lookup.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN clients.notes
      IS 'Sensitive free text. Writes are audited in V1; read audit is planned for V4.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN clients.anonymization_requested_at
      IS 'Prepared for GDPR right-to-be-forgotten workflow in V4.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS client_addresses_tenant_isolation ON client_addresses;
    `);
    await queryRunner.query(`DROP POLICY IF EXISTS clients_tenant_isolation ON clients;`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_addresses;`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients;`);
  }
}
