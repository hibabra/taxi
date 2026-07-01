import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { AuthUserRecord } from '../types/auth-user.interface';
import { UserRole } from '../types/role.enum';

type AuthUserRow = {
  id: string;
  email: string;
  groupement_id: string | null;
  groupement_name: string | null;
  groupement_is_active?: boolean | null;
  is_active: boolean | null;
  password_hash: string | null;
  password_updated_at: Date | string | null;
  roles: unknown;
  driver_id?: string | null;
  driver_identifier?: string | null;
  is_group_admin?: boolean | null;
};

type DatabaseDriverError = {
  code?: string;
};

@Injectable()
export class AuthUsersRepository {
  private usersTableExists?: boolean;

  constructor(private readonly dataSource: DataSource) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.findOne(
      `
        SELECT
          u.id,
          u.email,
          u.groupement_id,
          g.name AS groupement_name,
          COALESCE(g.is_active, true) AS groupement_is_active,
          u.is_active,
          u.password_hash,
          u.password_updated_at,
          u.roles,
          d.id AS driver_id,
          d.driver_identifier,
          d.is_group_admin
        FROM users u
        LEFT JOIN groupements g ON g.id = u.groupement_id
        LEFT JOIN drivers d ON d.user_id = u.id
        WHERE lower(u.email) = lower($1)
        LIMIT 1
      `,
      [email],
    );
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    return this.findOne(
      `
        SELECT
          u.id,
          u.email,
          u.groupement_id,
          g.name AS groupement_name,
          COALESCE(g.is_active, true) AS groupement_is_active,
          u.is_active,
          u.password_hash,
          u.password_updated_at,
          u.roles,
          d.id AS driver_id,
          d.driver_identifier,
          d.is_group_admin
        FROM users u
        LEFT JOIN groupements g ON g.id = u.groupement_id
        LEFT JOIN drivers d ON d.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [id],
    );
  }

  async findByGroupementCodeAndDriverIdentifier(
    groupementCode: string,
    driverIdentifier: string,
  ): Promise<AuthUserRecord | null> {
    return this.findOne(
      `
        SELECT
          u.id,
          u.email,
          u.groupement_id,
          g.name AS groupement_name,
          g.is_active AS groupement_is_active,
          u.is_active,
          u.password_hash,
          u.password_updated_at,
          u.roles,
          d.id AS driver_id,
          d.driver_identifier,
          d.is_group_admin
        FROM groupements g
        INNER JOIN drivers d ON d.groupement_id = g.id
        INNER JOIN users u ON u.id = d.user_id
        WHERE lower(g.code) = lower($1)
          AND upper(d.driver_identifier) = upper($2)
        LIMIT 1
      `,
      [groupementCode.trim(), driverIdentifier.trim()],
    );
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    passwordUpdatedAt: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.auth_lookup = 'on'`);
      await manager.query(
        `
          UPDATE users
          SET password_hash = $1, password_updated_at = $2
          WHERE id = $3
        `,
        [passwordHash, passwordUpdatedAt, userId],
      );
    });
  }

  async updateLastLoginAt(
    userId: string,
    lastLoginAt: Date,
    manager?: EntityManager,
  ): Promise<void> {
    const update = async (entityManager: EntityManager) => {
      await entityManager.query(`SET LOCAL app.auth_lookup = 'on'`);
      await entityManager.query(
        `
          UPDATE users
          SET last_login_at = $1
          WHERE id = $2
        `,
        [lastLoginAt, userId],
      );
    };

    if (manager) {
      await update(manager);
      return;
    }

    await this.dataSource.transaction(update);
  }

  private async findOne(query: string, parameters: unknown[]): Promise<AuthUserRecord | null> {
    if (!(await this.hasUsersTable())) {
      return null;
    }

    try {
      const rows = await this.dataSource.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.auth_lookup = 'on'`);
        return manager.query<AuthUserRow[]>(query, parameters);
      });
      const [row] = rows;

      return row ? mapAuthUserRow(row) : null;
    } catch (error) {
      if (isUndefinedTableError(error)) {
        this.usersTableExists = false;
        return null;
      }

      throw error;
    }
  }

  private async hasUsersTable(): Promise<boolean> {
    if (this.usersTableExists !== undefined) {
      return this.usersTableExists;
    }

    const rows = await this.dataSource.query<Array<{ table_name: string | null }>>(
      `SELECT to_regclass('public.users')::text AS table_name`,
    );
    const tableName = rows[0]?.table_name ?? null;
    this.usersTableExists = tableName === 'users' || tableName === 'public.users';

    return this.usersTableExists;
  }
}

function mapAuthUserRow(row: AuthUserRow): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    groupementId: row.groupement_id,
    groupementName: row.groupement_name ?? null,
    groupementIsActive: row.groupement_is_active !== false,
    isActive: row.is_active !== false,
    passwordHash: row.password_hash,
    passwordUpdatedAt: row.password_updated_at ? new Date(row.password_updated_at) : null,
    roles: parseRoles(row.roles),
    driverId: row.driver_id ?? null,
    driverIdentifier: row.driver_identifier ?? null,
    isGroupAdmin: row.is_group_admin === true,
  };
}

function parseRoles(value: unknown): UserRole[] {
  if (Array.isArray(value)) {
    return value.filter(isUserRole);
  }

  if (typeof value === 'string') {
    const postgresArrayRoles = value
      .replace(/^{|}$/g, '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

    return postgresArrayRoles.filter(isUserRole);
  }

  return [];
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.values(UserRole).includes(value as UserRole);
}

function isUndefinedTableError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as DatabaseDriverError;
  return driverError.code === '42P01';
}
