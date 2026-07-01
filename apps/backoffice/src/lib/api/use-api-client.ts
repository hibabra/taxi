'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { useAdminStore } from '@/lib/state/admin-store';

import { createApiClient } from './client';

export function useApiClient(groupementOverride?: string | null) {
  const { data: session } = useSession();
  const selectedGroupementId = useAdminStore((state) => state.selectedGroupementId);
  const sessionGroupementId = session?.user.groupementId ?? null;
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;
  const groupementId =
    groupementOverride === undefined
      ? isSuperAdmin
        ? selectedGroupementId
        : sessionGroupementId
      : groupementOverride;

  return useMemo(
    () =>
      createApiClient({
        accessToken: session?.accessToken,
        groupementId,
      }),
    [groupementId, session?.accessToken],
  );
}

export function useEffectiveGroupementId(): null | string {
  const { data: session } = useSession();
  const selectedGroupementId = useAdminStore((state) => state.selectedGroupementId);
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;

  return isSuperAdmin ? selectedGroupementId : (session?.user.groupementId ?? null);
}
