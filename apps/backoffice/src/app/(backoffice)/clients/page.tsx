'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateClientPayload } from '@taxikiwi/shared-types';
import { Archive, Ban, BookUser, Search, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { ListPagination } from '@/components/backoffice/list-pagination';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { ReasonActionDialog } from '@/components/backoffice/reason-action-dialog';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { ClientFormDialog } from '@/components/features/backoffice/client-form-dialog';
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
  archiveClient,
  blacklistClient,
  createClient,
  listClients,
  unarchiveClient,
  unblacklistClient,
} from '@/lib/api/clients.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { formatDateTime } from '@/lib/format';

export default function ClientsPage() {
  const [blacklistFilter, setBlacklistFilter] = useState<'ALL' | 'BLACKLISTED' | 'CLEAR'>('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();
  const filters = {
    includeArchived,
    isBlacklisted: blacklistFilter === 'ALL' ? undefined : blacklistFilter === 'BLACKLISTED',
    limit: 20,
    page,
    search: search || undefined,
  };

  const clientsQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listClients(client, filters),
    queryKey: queryKeys.clients(groupementId ?? 'none', filters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientPayload) => createClient(client, payload),
    onSuccess: async () => {
      toast.success('Client créé');
      await queryClient.invalidateQueries({ queryKey: ['clients', groupementId] });
    },
    onError: (error) => {
      toast.error('Création impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (clientId: string) => archiveClient(client, clientId),
    onSuccess: async () => {
      toast.success('Client archivé');
      await queryClient.invalidateQueries({ queryKey: ['clients', groupementId] });
    },
    onError: (error) => {
      toast.error('Archivage impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (clientId: string) => unarchiveClient(client, clientId),
    onSuccess: async () => {
      toast.success('Client réactivé');
      await queryClient.invalidateQueries({ queryKey: ['clients', groupementId] });
    },
    onError: (error) => {
      toast.error('Réactivation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason: string }) =>
      blacklistClient(client, clientId, reason),
    onSuccess: async () => {
      toast.success('Client blacklisté');
      await queryClient.invalidateQueries({ queryKey: ['clients', groupementId] });
    },
    onError: (error) => {
      toast.error('Blacklist impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const unblacklistMutation = useMutation({
    mutationFn: (clientId: string) => unblacklistClient(client, clientId),
    onSuccess: async () => {
      toast.success('Client retiré de blacklist');
      await queryClient.invalidateQueries({ queryKey: ['clients', groupementId] });
    },
    onError: (error) => {
      toast.error('Retrait impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Clients">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell
      actions={
        <ClientFormDialog
          loading={createMutation.isPending}
          onCreate={(payload) => createMutation.mutateAsync(payload)}
        />
      }
      eyebrow="Groupement"
      title="Clients"
    >
      <SummaryStrip
        items={[
          {
            icon: BookUser,
            label: 'Clients',
            tone: 'info',
            value: clientsQuery.data?.meta.total ?? '-',
          },
          {
            detail: 'Comptes sans alerte visible',
            icon: UserRoundCheck,
            label: 'Actifs affichés',
            tone: 'good',
            value:
              clientsQuery.data?.data.filter(
                (clientItem) => !clientItem.isBlacklisted && !clientItem.archivedAt,
              ).length ?? '-',
          },
          {
            detail: 'À vérifier avant attribution',
            icon: Ban,
            label: 'Blacklistés affichés',
            tone: 'danger',
            value:
              clientsQuery.data?.data.filter((clientItem) => clientItem.isBlacklisted).length ??
              '-',
          },
          {
            detail: includeArchived ? 'Inclus dans la recherche' : 'Masqués par défaut',
            icon: Archive,
            label: 'Archives',
            value:
              clientsQuery.data?.data.filter((clientItem) => clientItem.archivedAt).length ?? '-',
          },
        ]}
      />
      <DataPanel>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Nom ou téléphone"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <Select
            value={blacklistFilter}
            onValueChange={(value) => {
              setPage(1);
              setBlacklistFilter(value as typeof blacklistFilter);
            }}
          >
            <SelectTrigger className="lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les clients</SelectItem>
              <SelectItem value="CLEAR">Sans blacklist</SelectItem>
              <SelectItem value="BLACKLISTED">Blacklistés</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={includeArchived ? 'WITH_ARCHIVES' : 'ACTIVE_ONLY'}
            onValueChange={(value) => {
              setPage(1);
              setIncludeArchived(value === 'WITH_ARCHIVES');
            }}
          >
            <SelectTrigger className="lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE_ONLY">Clients actifs</SelectItem>
              <SelectItem value="WITH_ARCHIVES">Inclure archives</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {clientsQuery.isLoading && <LoadingState />}
        {clientsQuery.isError && (
          <ErrorState error={clientsQuery.error} onRetry={() => void clientsQuery.refetch()} />
        )}
        {clientsQuery.data?.data.length === 0 && (
          <EmptyState
            title="Aucun client"
            message="Aucun client ne correspond aux filtres actuels."
          />
        )}
        {clientsQuery.data && clientsQuery.data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Adresses</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsQuery.data.data.map((clientItem) => (
                <TableRow key={clientItem.id}>
                  <TableCell className="font-medium">{clientItem.fullName}</TableCell>
                  <TableCell>{clientItem.phoneE164}</TableCell>
                  <TableCell>{clientItem.email ?? '-'}</TableCell>
                  <TableCell>{clientItem.addresses.length}</TableCell>
                  <TableCell>
                    {clientItem.isBlacklisted ? (
                      <Badge variant="destructive">Blacklisté</Badge>
                    ) : clientItem.archivedAt ? (
                      <Badge variant="outline">Archivé</Badge>
                    ) : (
                      <Badge variant="secondary">Actif</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(clientItem.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {clientItem.isBlacklisted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unblacklistMutation.mutate(clientItem.id)}
                        >
                          Retirer blacklist
                        </Button>
                      ) : (
                        <ReasonActionDialog
                          buttonLabel="Blacklister"
                          description="Le motif sera visible dans l’audit et utile au support."
                          loading={blacklistMutation.isPending}
                          title="Blacklister le client"
                          variant="destructive"
                          onConfirm={(reason) =>
                            blacklistMutation.mutateAsync({ clientId: clientItem.id, reason })
                          }
                        />
                      )}
                      {clientItem.archivedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unarchiveMutation.mutate(clientItem.id)}
                        >
                          Réactiver
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => archiveMutation.mutate(clientItem.id)}
                        >
                          Archiver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {clientsQuery.data && (
          <ListPagination meta={clientsQuery.data.meta} onPageChange={setPage} />
        )}
      </DataPanel>
    </PageShell>
  );
}
