'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateGroupementPayload, UpdateGroupementPayload } from '@taxikiwi/shared-types';
import { Building2, CheckCircle2, ExternalLink, PowerOff, Search, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { ListPagination } from '@/components/backoffice/list-pagination';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { SuperAdminOnly } from '@/components/backoffice/role-gate';
import { GroupementCreateDialog } from '@/components/features/backoffice/groupement-create-dialog';
import { GroupementDeleteDialog } from '@/components/features/backoffice/groupement-delete-dialog';
import { GroupementEditDialog } from '@/components/features/backoffice/groupement-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createGroupement,
  deactivateGroupement,
  deleteGroupement,
  listGroupements,
  updateGroupement,
} from '@/lib/api/groupements.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient } from '@/lib/api/use-api-client';
import { formatDateTime } from '@/lib/format';

export default function GroupementsPage() {
  const [isActive, setIsActive] = useState<'ACTIVE' | 'ALL' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const client = useApiClient(null);
  const queryClient = useQueryClient();
  const filters = {
    isActive: isActive === 'ALL' ? undefined : isActive === 'ACTIVE',
    limit: 20,
    page,
    search: search || undefined,
  };

  const groupementsQuery = useQuery({
    queryFn: () => listGroupements(client, filters),
    queryKey: queryKeys.groupements(filters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateGroupementPayload) => createGroupement(client, payload),
    onSuccess: async () => {
      toast.success('Groupement créé');
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Création refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (groupementId: string) => deactivateGroupement(client, groupementId),
    onSuccess: async () => {
      toast.success('Groupement désactivé');
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Désactivation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      groupementId,
      payload,
    }: {
      groupementId: string;
      payload: UpdateGroupementPayload;
    }) => updateGroupement(client, groupementId, payload),
    onSuccess: async () => {
      toast.success('Groupement modifié');
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Modification impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (groupementId: string) => deleteGroupement(client, groupementId),
    onSuccess: async () => {
      toast.success('Groupement supprimé');
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Suppression impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  return (
    <SuperAdminOnly>
      <PageShell
        actions={
          <GroupementCreateDialog
            loading={createMutation.isPending}
            onCreate={(payload) => createMutation.mutateAsync(payload)}
          />
        }
        eyebrow="Plateforme"
        title="Groupements"
      >
        <SummaryStrip
          items={[
            {
              icon: Building2,
              label: 'Groupements',
              tone: 'info',
              value: groupementsQuery.data?.meta.total ?? '-',
            },
            {
              detail: 'Sur la page affichée',
              icon: CheckCircle2,
              label: 'Actifs',
              tone: 'good',
              value:
                groupementsQuery.data?.data.filter((groupement) => groupement.isActive).length ??
                '-',
            },
            {
              detail: 'Désactivés ou suspendus',
              icon: XCircle,
              label: 'Inactifs',
              tone: 'warning',
              value:
                groupementsQuery.data?.data.filter((groupement) => !groupement.isActive).length ??
                '-',
            },
          ]}
        />

        <DataPanel>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un groupement"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
              />
            </div>
            <Select
              value={isActive}
              onValueChange={(value) => {
                setPage(1);
                setIsActive(value as typeof isActive);
              }}
            >
              <SelectTrigger className="lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="ACTIVE">Actifs</SelectItem>
                <SelectItem value="INACTIVE">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {groupementsQuery.isLoading && <LoadingState />}
          {groupementsQuery.isError && (
            <ErrorState
              error={groupementsQuery.error}
              onRetry={() => void groupementsQuery.refetch()}
            />
          )}
          {groupementsQuery.data?.data.length === 0 && (
            <EmptyState
              title="Aucun groupement"
              message="Aucun resultat ne correspond aux filtres actuels."
            />
          )}
          {groupementsQuery.data && groupementsQuery.data.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupementsQuery.data.data.map((groupement) => (
                  <TableRow key={groupement.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:text-primary" href={`/groupements/${groupement.id}`}>
                        {groupement.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">{groupement.code}</TableCell>
                    <TableCell>{groupement.city}</TableCell>
                    <TableCell>
                      <Badge variant={groupement.isActive ? 'default' : 'secondary'}>
                        {groupement.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(groupement.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/groupements/${groupement.id}`}>
                            <ExternalLink className="size-4" />
                            Ouvrir
                          </Link>
                        </Button>
                        <GroupementEditDialog
                          groupement={groupement}
                          loading={updateMutation.isPending}
                          onSave={(payload) =>
                            updateMutation.mutateAsync({ groupementId: groupement.id, payload })
                          }
                        />
                        {groupement.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deactivateMutation.mutate(groupement.id)}
                          >
                            <PowerOff className="size-4" />
                            Désactiver
                          </Button>
                        )}
                        <GroupementDeleteDialog
                          groupement={groupement}
                          loading={deleteMutation.isPending}
                          onDelete={() => deleteMutation.mutateAsync(groupement.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {groupementsQuery.data && (
            <ListPagination meta={groupementsQuery.data.meta} onPageChange={setPage} />
          )}
        </DataPanel>
      </PageShell>
    </SuperAdminOnly>
  );
}
