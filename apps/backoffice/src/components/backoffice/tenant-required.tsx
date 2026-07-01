import { Building2 } from 'lucide-react';

import { EmptyState } from './api-state';

export function TenantRequired() {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-4 grid size-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Building2 className="size-5" />
      </div>
      <EmptyState
        title="Choisir un groupement"
        message="Selectionnez un groupement dans la barre superieure pour continuer."
      />
    </div>
  );
}
