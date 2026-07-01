import { TenantContext, TenantData } from '../tenant-context';

describe('TenantContext', () => {
  const mockTenant: TenantData = {
    groupementId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440001',
  };

  it('returns tenant data inside a run() callback', () => {
    TenantContext.run(mockTenant, () => {
      const result = TenantContext.get();

      expect(result).toEqual(mockTenant);
    });
  });

  it('returns null outside a run() callback via getOrNull()', () => {
    const result = TenantContext.getOrNull();

    expect(result).toBeNull();
  });

  it('throws when get() is called outside a run() callback', () => {
    expect(() => TenantContext.get()).toThrow(
      'TenantContext.get() called outside of a tenant-scoped request',
    );
  });

  it('returns the groupementId via getGroupementId()', () => {
    TenantContext.run(mockTenant, () => {
      expect(TenantContext.getGroupementId()).toBe(mockTenant.groupementId);
    });
  });

  it('returns the userId via getUserId()', () => {
    TenantContext.run(mockTenant, () => {
      expect(TenantContext.getUserId()).toBe(mockTenant.userId);
    });
  });

  it('isolates concurrent contexts from each other', async () => {
    const tenantA: TenantData = {
      groupementId: 'aaaa0000-0000-0000-0000-000000000000',
      userId: 'aaaa0000-0000-0000-0000-000000000001',
    };
    const tenantB: TenantData = {
      groupementId: 'bbbb0000-0000-0000-0000-000000000000',
      userId: 'bbbb0000-0000-0000-0000-000000000001',
    };

    await Promise.all([
      new Promise<void>((resolve) => {
        TenantContext.run(tenantA, () => {
          expect(TenantContext.getGroupementId()).toBe(tenantA.groupementId);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        TenantContext.run(tenantB, () => {
          expect(TenantContext.getGroupementId()).toBe(tenantB.groupementId);
          resolve();
        });
      }),
    ]);
  });
});
