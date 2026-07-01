'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getQueue, dequeueFirst } from '@/lib/api/queue.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { userFacingApiMessage } from '@/lib/api/errors';

type DriverAvailabilityStatus =
  | 'LIBRE'
  | 'COURSE'
  | 'ABSENT'
  | 'HORS_SERVICE'
  | 'STATION';

const STATUS_STYLES: Record<DriverAvailabilityStatus, { label: string; className: string }> = {
  LIBRE:        { label: 'LIBRE',        className: 'bg-green-500 text-white' },
  COURSE:       { label: 'COURSE',       className: 'bg-red-500 text-white' },
  ABSENT:       { label: 'ABSENT',       className: 'bg-gray-500 text-white' },
  HORS_SERVICE: { label: 'HORS SERVICE', className: 'bg-gray-900 text-white' },
  STATION:      { label: 'STATION',      className: 'bg-blue-500 text-white' },
};

export default function TourDeRolePage() {
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => getQueue(client),
    queryKey: queryKeys.queue(groupementId ?? 'none'),
    refetchInterval: 10_000,
  });

  const dequeueMutation = useMutation({
    mutationFn: () => dequeueFirst(client),
    onSuccess: async (driverId) => {
      if (driverId) {
        toast.success('Course attribuée', {
          description: `Chauffeur ${driverId} mis en COURSE`,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.queue(groupementId ?? 'none'),
      });
    },
    onError: (error) => {
      toast.error('Erreur', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Tour de rôle">
        <TenantRequired />
      </PageShell>
    );
  }

  const entries = queueQuery.data?.entries ?? [];
  const stationCount = entries.filter((e) => e.status === 'STATION').length;
  const libreCount = entries.filter((e) => e.status === 'LIBRE').length;
  const courseCount = entries.filter((e) => e.status === 'COURSE').length;

  return (
    <PageShell eyebrow="Groupement" title="Tour de rôle">
      <SummaryStrip
        items={[
          {
            icon: Users,
            label: 'Total chauffeurs',
            tone: 'info',
            value: queueQuery.data?.total ?? '-',
          },
          {
            icon: Users,
            label: 'En station',
            tone: 'good',
            value: stationCount,
          },
          {
            icon: Users,
            label: 'Libres',
            tone: 'good',
            value: libreCount,
          },
          {
            icon: Users,
            label: 'En course',
            tone: 'warning',
            value: courseCount,
          },
        ]}
      />

      <DataPanel title="File d'attente">
        {}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void queueQuery.refetch()}
          >
            <RefreshCw className="size-4 mr-1" />
            Rafraîchir
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={dequeueMutation.isPending || entries.length === 0}
            onClick={() => dequeueMutation.mutate()}
          >
            Attribuer une course
          </Button>
        </div>

        {queueQuery.isLoading && <LoadingState />}
        {queueQuery.isError && (
          <ErrorState
            error={queueQuery.error}
            onRetry={() => void queueQuery.refetch()}
          />
        )}
        {entries.length === 0 && !queueQuery.isLoading && (
          <EmptyState
            title="File vide"
            message="Aucun chauffeur dans le tour de rôle pour le moment."
          />
        )}
        {entries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Arrivée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const style =
                  STATUS_STYLES[entry.status as DriverAvailabilityStatus] ??
                  STATUS_STYLES['ABSENT'];
                return (
                  <TableRow key={entry.driverId}>
                    <TableCell className="font-bold text-lg">
                      #{entry.position}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {entry.driverIdentifier}
                    </TableCell>
                    <TableCell>
                      {entry.firstName} {entry.lastName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-xs font-bold ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(entry.joinedQueueAt).toLocaleTimeString('fr-FR')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataPanel>
    </PageShell>
  );
}