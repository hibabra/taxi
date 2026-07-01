'use client';

import { useQuery } from '@tanstack/react-query';
import { ListFilter } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SuperAdminOnly } from '@/components/backoffice/role-gate';
import { AuditTable } from '@/components/features/backoffice/audit-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listAuditLogs } from '@/lib/api/audit.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient } from '@/lib/api/use-api-client';
import { AUDIT_ACTION_OPTIONS } from '@/lib/audit-display';
import { useAdminStore } from '@/lib/state/admin-store';

export default function AuditPage() {
  const [action, setAction] = useState('');
  const selectedGroupementId = useAdminStore((state) => state.selectedGroupementId);
  const client = useApiClient(selectedGroupementId);
  const filters = {
    action: action || undefined,
    groupementId: selectedGroupementId ?? undefined,
    limit: 20,
    page: 1,
  };

  const auditQuery = useQuery({
    queryFn: () => listAuditLogs(client, filters),
    queryKey: queryKeys.audit(filters),
  });

  return (
    <SuperAdminOnly>
      <PageShell eyebrow="Plateforme" title="Journal d'audit">
        <DataPanel>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ListFilter className="size-4 text-muted-foreground" />
            <Select
              value={action || 'all'}
              onValueChange={(value) => setAction(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Toutes les actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {AUDIT_ACTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {auditQuery.isLoading && <LoadingState />}
          {auditQuery.isError && (
            <ErrorState error={auditQuery.error} onRetry={() => void auditQuery.refetch()} />
          )}
          {auditQuery.data?.data.length === 0 && (
            <EmptyState title="Aucun audit" message="Aucune entrée ne correspond aux filtres." />
          )}
          {auditQuery.data && auditQuery.data.data.length > 0 && (
            <AuditTable entries={auditQuery.data.data} />
          )}
        </DataPanel>
      </PageShell>
    </SuperAdminOnly>
  );
}
