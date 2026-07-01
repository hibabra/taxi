import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

import { TenantContext } from './tenant-context';

/**
 * Service qui propage le groupementId courant vers PostgreSQL
 * via la variable de session `app.current_groupement_id`.
 *
 * Cette variable est lue par les politiques RLS pour filtrer
 * automatiquement les lignes par tenant, même si le code
 * applicatif oublie son WHERE.
 */
@Injectable()
export class TenancyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Positionne la variable de session PostgreSQL pour RLS.
   * Doit être appelé au début de chaque transaction tenant-scoped.
   *
   * `SET LOCAL` limite la portée à la transaction courante,
   * ce qui évite les fuites entre requêtes concurrentes
   * partageant la même connexion du pool.
   */
  async setTenantOnQueryRunner(queryRunner: QueryRunner): Promise<void> {
    const tenant = TenantContext.getOrNull();

    if (!tenant) {
      return;
    }

    await queryRunner.query(`SELECT set_config('app.current_groupement_id', $1, true)`, [
      tenant.groupementId,
    ]);
  }

  /**
   * Exécute un callback dans une transaction tenant-scoped.
   * La variable RLS est positionnée automatiquement.
   *
   * @example
   * await tenancyService.withTenantTransaction(async (queryRunner) => {
   *   await queryRunner.manager.save(entity);
   * });
   */
  async withTenantTransaction<T>(callback: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    // 🟢 DEBUG
    console.log('TENANT IN REQUEST:', TenantContext.getOrNull());

    try {
      await this.setTenantOnQueryRunner(queryRunner);

      const result = await callback(queryRunner);

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
