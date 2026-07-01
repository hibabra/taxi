import { DataSource } from 'typeorm';

import { AuthUsersRepository } from '../repositories/auth-users.repository';
import { UserRole } from '../types/role.enum';

describe('AuthUsersRepository', () => {
  let query: jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;
  let transaction: jest.Mock<
    Promise<unknown>,
    [(manager: { query: typeof query }) => Promise<unknown>]
  >;
  let repository: AuthUsersRepository;

  beforeEach(() => {
    query = jest.fn((sql: string, parameters?: unknown[]) => {
      void sql;
      void parameters;
      return Promise.resolve([]);
    });
    transaction = jest.fn((callback) => callback({ query }));
    repository = new AuthUsersRepository({ query, transaction } as unknown as DataSource);
  });

  it('maps a user row from the future users table', async () => {
    query
      .mockResolvedValueOnce([{ table_name: 'users' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          email: 'admin@taxikiwi.local',
          groupement_id: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
          groupement_is_active: true,
          id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
          is_active: true,
          password_hash: '$argon2id$hash',
          password_updated_at: '2026-04-30T12:00:00.000Z',
          roles: [UserRole.ADMIN, 'UNKNOWN'],
        },
      ]);

    const user = await repository.findByEmail('admin@taxikiwi.local');

    expect(user).toMatchObject({
      email: 'admin@taxikiwi.local',
      groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
      groupementIsActive: true,
      id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      isActive: true,
      passwordHash: '$argon2id$hash',
      roles: [UserRole.ADMIN],
    });
    expect(user?.passwordUpdatedAt).toBeInstanceOf(Date);
  });

  it('returns null without querying users when the table is not created yet', async () => {
    query.mockResolvedValueOnce([{ table_name: null }]);

    await expect(repository.findByEmail('missing@taxikiwi.local')).resolves.toBeNull();
    await expect(repository.findById('c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c')).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('updates password credentials without returning sensitive data', async () => {
    query.mockResolvedValueOnce([]);

    await repository.updatePassword(
      'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      '$argon2id$new-hash',
      new Date('2026-04-30T12:00:00.000Z'),
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
      '$argon2id$new-hash',
      new Date('2026-04-30T12:00:00.000Z'),
      'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    ]);
  });

  it('updates last login timestamp through the auth lookup path', async () => {
    query.mockResolvedValueOnce([]);

    await repository.updateLastLoginAt(
      'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
      new Date('2026-05-03T12:00:00.000Z'),
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
      new Date('2026-05-03T12:00:00.000Z'),
      'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
    ]);
  });
});
