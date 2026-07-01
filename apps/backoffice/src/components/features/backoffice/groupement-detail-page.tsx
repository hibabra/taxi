'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateGroupementPayload,
  UpdateGroupementSettingsPayload,
} from '@taxikiwi/shared-types';
import { Mail, MapPin, Phone, PowerOff, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { DetailRow } from '@/components/backoffice/detail-row';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { SuperAdminOnly } from '@/components/backoffice/role-gate';
import { GroupementDeleteDialog } from '@/components/features/backoffice/groupement-delete-dialog';
import { GroupementEditDialog } from '@/components/features/backoffice/groupement-edit-dialog';
import { GroupementSettingsDialog } from '@/components/features/backoffice/groupement-settings-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  deactivateGroupement,
  deleteGroupement,
  getGroupement,
  updateGroupement,
  updateGroupementSettings,
} from '@/lib/api/groupements.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient } from '@/lib/api/use-api-client';
import { DISPATCH_POLICY_LABELS } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';
import { useAdminStore } from '@/lib/state/admin-store';

export function GroupementDetailPage({ groupementId }: { groupementId: string }) {
  const setSelectedGroupementId = useAdminStore((state) => state.setSelectedGroupementId);
  const platformClient = useApiClient(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    setSelectedGroupementId(groupementId);
  }, [groupementId, setSelectedGroupementId]);

  const groupementQuery = useQuery({
    queryFn: () => getGroupement(platformClient, groupementId),
    queryKey: queryKeys.groupement(groupementId),
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: UpdateGroupementSettingsPayload) =>
      updateGroupementSettings(platformClient, groupementId, payload),
    onSuccess: async () => {
      toast.success('Paramètres mis à jour');
      await queryClient.invalidateQueries({ queryKey: queryKeys.groupement(groupementId) });
    },
    onError: (error) => {
      toast.error('Mise à jour impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateGroupementPayload) =>
      updateGroupement(platformClient, groupementId, payload),
    onSuccess: async () => {
      toast.success('Groupement modifié');
      await queryClient.invalidateQueries({ queryKey: queryKeys.groupement(groupementId) });
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Modification impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateGroupement(platformClient, groupementId),
    onSuccess: async () => {
      toast.success('Groupement désactivé');
      await queryClient.invalidateQueries({ queryKey: queryKeys.groupement(groupementId) });
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
    },
    onError: (error) => {
      toast.error('Désactivation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroupement(platformClient, groupementId),
    onSuccess: async () => {
      toast.success('Groupement supprimé');
      setSelectedGroupementId(null);
      await queryClient.invalidateQueries({ queryKey: ['groupements'] });
      router.push('/groupements');
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
          groupementQuery.data ? (
            <div className="flex flex-wrap justify-end gap-2">
              <GroupementEditDialog
                groupement={groupementQuery.data}
                loading={updateMutation.isPending}
                onSave={(payload) => updateMutation.mutateAsync(payload)}
              />
              <GroupementSettingsDialog
                groupement={groupementQuery.data}
                loading={settingsMutation.isPending}
                onSave={(payload) => settingsMutation.mutateAsync(payload)}
              />
              {groupementQuery.data.isActive && (
                <Button size="sm" variant="destructive" onClick={() => deactivateMutation.mutate()}>
                  <PowerOff className="size-4" />
                  Désactiver
                </Button>
              )}
              <GroupementDeleteDialog
                groupement={groupementQuery.data}
                loading={deleteMutation.isPending}
                onDelete={() => deleteMutation.mutateAsync()}
              />
            </div>
          ) : undefined
        }
        eyebrow="Groupement"
        title={groupementQuery.data?.name ?? 'Détail groupement'}
      >
        {groupementQuery.isLoading && <LoadingState />}
        {groupementQuery.isError && (
          <ErrorState
            error={groupementQuery.error}
            onRetry={() => void groupementQuery.refetch()}
          />
        )}
        {groupementQuery.data && (
          <>
            <SummaryStrip
              items={[
                {
                  detail: groupementQuery.data.city,
                  icon: MapPin,
                  label: 'Zone',
                  tone: 'info',
                  value: groupementQuery.data.code,
                },
                {
                  detail: groupementQuery.data.contactEmail,
                  icon: Mail,
                  label: 'Email',
                  tone: 'good',
                  value: 'Contact',
                },
                {
                  detail: groupementQuery.data.contactPhone,
                  icon: Phone,
                  label: 'Téléphone',
                  value: 'Contact',
                },
                {
                  detail: `${groupementQuery.data.settings?.ringTimeoutSeconds ?? '-'} secondes`,
                  icon: Settings,
                  label: 'Distribution',
                  value:
                    DISPATCH_POLICY_LABELS[
                      groupementQuery.data.settings?.dispatchPolicy ?? 'STATION_FIRST'
                    ],
                },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <DataPanel title="Identite">
                <div className="grid gap-3 text-sm">
                  <DetailRow label="Nom" value={groupementQuery.data.name} />
                  <DetailRow label="Code" value={groupementQuery.data.code} mono />
                  <DetailRow
                    label="Adresse"
                    value={`${groupementQuery.data.address}, ${groupementQuery.data.postalCode} ${groupementQuery.data.city}`}
                  />
                  <DetailRow label="Contact" value={groupementQuery.data.contactEmail} />
                  <DetailRow label="Telephone" value={groupementQuery.data.contactPhone} />
                  <DetailRow
                    label="Statut"
                    value={
                      <Badge variant={groupementQuery.data.isActive ? 'default' : 'outline'}>
                        {groupementQuery.data.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    }
                  />
                  <DetailRow
                    label="Cree le"
                    value={formatDateTime(groupementQuery.data.createdAt)}
                  />
                </div>
                <Separator className="my-4" />
                <DetailRow
                  label="Zone de service"
                  value={groupementQuery.data.serviceArea || 'Non renseignée'}
                />
              </DataPanel>

              <DataPanel title="Paramètres">
                <div className="grid gap-3 text-sm">
                  <DetailRow
                    label="Politique de distribution"
                    value={
                      DISPATCH_POLICY_LABELS[
                        groupementQuery.data.settings?.dispatchPolicy ?? 'STATION_FIRST'
                      ]
                    }
                  />
                  <DetailRow
                    label="Délai de sonnerie"
                    value={`${groupementQuery.data.settings?.ringTimeoutSeconds ?? '-'} secondes`}
                  />
                  <DetailRow
                    label="Couleur principale"
                    value={groupementQuery.data.settings?.primaryColor ?? '-'}
                    mono
                  />
                </div>
              </DataPanel>
            </div>
          </>
        )}
      </PageShell>
    </SuperAdminOnly>
  );
}
