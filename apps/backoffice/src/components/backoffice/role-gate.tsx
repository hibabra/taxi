'use client';

import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';

import { EmptyState } from './api-state';

export function SuperAdminOnly({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  if (!session?.user.roles.includes('SUPER_ADMIN')) {
    return (
      <EmptyState
        title="Acces reserve super admin"
        message="Cette page est volontairement limitee aux actions plateforme."
      />
    );
  }

  return children;
}
