'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDriverInvitationPayload, DriverStatus } from '@taxikiwi/shared-types';
import { AlertTriangle, Car, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { ListPagination } from '@/components/backoffice/list-pagination';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { ReasonActionDialog } from '@/components/backoffice/reason-action-dialog';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { DriverInvitationForm } from '@/components/features/backoffice/driver-invitation-form';
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
  createDriverInvitation,
  listDrivers,
  offboardDriver,
  reactivateDriver,
  suspendDriver,
} from '@/lib/api/drivers.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { userFacingApiMessage } from '@/lib/api/errors';
import { DRIVER_STATUS_LABELS } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';

const allStatuses = ['ACTIVE', 'SUSPENDED', 'OFFBOARDED'] as const;

export default function DriversPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;

  /** SUPER_ADMIN = lecture seule ; ADMIN = gestion complète */
  const canManageDrivers = !isSuperAdmin;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DriverStatus | 'ALL'>('ALL');
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();
  const filters = {
    limit: 20,
    page,
    search: search || undefined,
    status: status === 'ALL' ? undefined : status,
  };

  const driversQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listDrivers(client, filters),
    queryKey: queryKeys.drivers(groupementId ?? 'none', filters),
  });

  // --- Mutations (utilisées uniquement par l'ADMIN de groupement) ---

  const inviteMutation = useMutation({
    mutationFn: (payload: CreateDriverInvitationPayload) => createDriverInvitation(client, payload),
    onSuccess: async (invitation) => {
      toast.success('Invitation envoyée', {
        description: `Expire le ${formatDateTime(invitation.expiresAt)}`,
      });
      await queryClient.invalidateQueries({ queryKey: ['drivers', groupementId] });
    },
    onError: (error) => {
      toast.error('Invitation refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ driverId, reason }: { driverId: string; reason: string }) =>
      suspendDriver(client, driverId, reason),
    onSuccess: async () => {
      toast.success('Chauffeur suspendu');
      await queryClient.invalidateQueries({ queryKey: ['drivers', groupementId] });
    },
    onError: (error) => {
      toast.error('Suspension impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (driverId: string) => reactivateDriver(client, driverId),
    onSuccess: async () => {
      toast.success('Chauffeur réactivé');
      await queryClient.invalidateQueries({ queryKey: ['drivers', groupementId] });
    },
    onError: (error) => {
      toast.error('Réactivation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const offboardMutation = useMutation({
    mutationFn: (driverId: string) => offboardDriver(client, driverId),
    onSuccess: async () => {
      toast.success('Chauffeur sorti du groupement');
      await queryClient.invalidateQueries({ queryKey: ['drivers', groupementId] });
    },
    onError: (error) => {
      toast.error('Sortie impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Chauffeurs">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Groupement" title="Chauffeurs">
      <SummaryStrip
        items={[
          {
            icon: Car,
            label: 'Chauffeurs',
            tone: 'info',
            value: driversQuery.data?.meta.total ?? '-',
          },
          {
            detail: 'Disponibles pour exploitation',
            icon: UserRoundCheck,
            label: 'Actifs affichés',
            tone: 'good',
            value:
              driversQuery.data?.data.filter((driver) => driver.status === 'ACTIVE').length ?? '-',
          },
          {
            detail: 'À suivre avant réactivation',
            icon: AlertTriangle,
            label: 'Suspendus affichés',
            tone: 'warning',
            value:
              driversQuery.data?.data.filter((driver) => driver.status === 'SUSPENDED').length ??
              '-',
          },
          {
            detail: 'Responsables groupement',
            icon: ShieldCheck,
            label: 'Admins affichés',
            tone: 'good',
            value: driversQuery.data?.data.filter((driver) => driver.isGroupAdmin).length ?? '-',
          },
        ]}
      />

      {/* Formulaire d'invitation — visible UNIQUEMENT pour l'ADMIN de groupement */}
      {canManageDrivers && (
        <DataPanel title="Inviter un chauffeur">
          <DriverInvitationForm
            loading={inviteMutation.isPending}
            onInvite={(payload) => inviteMutation.mutateAsync(payload)}
          />
        </DataPanel>
      )}

      <DataPanel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Nom, prénom ou matricule"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1);
              setStatus(value as DriverStatus | 'ALL');
            }}
          >
            <SelectTrigger className="md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {allStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {DRIVER_STATUS_LABELS[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {driversQuery.isLoading && <LoadingState />}
        {driversQuery.isError && (
          <ErrorState error={driversQuery.error} onRetry={() => void driversQuery.refetch()} />
        )}
        {driversQuery.data?.data.length === 0 && (
          <EmptyState
            title="Aucun chauffeur"
            message="Aucun chauffeur ne correspond aux filtres actuels."
          />
        )}
        {driversQuery.data && driversQuery.data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identifiant</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Activation</TableHead>
                {canManageDrivers && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {driversQuery.data.data.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-mono">{driver.driverIdentifier}</TableCell>
                  <TableCell>
                    <div className="font-medium">{`${driver.firstName} ${driver.lastName}`}</div>
                    <div className="text-xs text-muted-foreground">{driver.matricule}</div>
                  </TableCell>
                  <TableCell>{driver.phoneE164}</TableCell>
                  <TableCell>
                    {driver.vehicleMake} {driver.vehicleModel}
                    <div className="text-xs text-muted-foreground">
                      {driver.vehicleRegistration}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={driver.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {DRIVER_STATUS_LABELS[driver.status].label}
                    </Badge>
                    {driver.isGroupAdmin && <Badge className="ml-2">Admin</Badge>}
                  </TableCell>
                  <TableCell>{formatDateTime(driver.mobileActivatedAt)}</TableCell>
                  {canManageDrivers && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {driver.status === 'ACTIVE' && (
                          <ReasonActionDialog
                            buttonLabel="Suspendre"
                            description="Le motif sera visible dans l'audit et aidera au suivi opérationnel."
                            loading={suspendMutation.isPending}
                            title="Suspendre le chauffeur"
                            onConfirm={(reason) =>
                              suspendMutation.mutateAsync({ driverId: driver.id, reason })
                            }
                          />
                        )}
                        {driver.status === 'SUSPENDED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reactivateMutation.mutate(driver.id)}
                          >
                            Réactiver
                          </Button>
                        )}
                        {driver.status !== 'OFFBOARDED' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => offboardMutation.mutate(driver.id)}
                          >
                            Sortir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {driversQuery.data && (
          <ListPagination meta={driversQuery.data.meta} onPageChange={setPage} />
        )}
      </DataPanel>
    </PageShell>
  );
}
