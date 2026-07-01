'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ChangePasswordPayload } from '@taxikiwi/shared-types';
import { Building2, KeyRound, ShieldCheck, UserCircle } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { DetailRow } from '@/components/backoffice/detail-row';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { ChangePasswordDialog } from '@/components/features/backoffice/change-password-dialog';
import { changePassword, getMe } from '@/lib/api/auth.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { getGroupement } from '@/lib/api/groupements.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { DISPATCH_POLICY_LABELS, USER_ROLE_LABELS } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';

export default function SettingsPage() {
  const { data: session } = useSession();
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const platformClient = useApiClient(null);
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;

  const meQuery = useQuery({
    queryFn: () => getMe(client),
    queryKey: queryKeys.me,
  });

  const groupementQuery = useQuery({
    enabled: isSuperAdmin && Boolean(groupementId),
    queryFn: () => getGroupement(platformClient, groupementId as string),
    queryKey: queryKeys.groupement(groupementId ?? 'none'),
  });

  const passwordMutation = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(client, payload),
    onSuccess: async () => {
      toast.success('Mot de passe changé');
      await signOut({ callbackUrl: '/login' });
    },
    onError: (error) => {
      toast.error('Changement refusé', {
        description: userFacingApiMessage(error),
      });
    },
  });

  return (
    <PageShell
      actions={
        <ChangePasswordDialog
          loading={passwordMutation.isPending}
          onChangePassword={(payload) => passwordMutation.mutateAsync(payload)}
        />
      }
      eyebrow="Compte"
      title="Paramètres"
    >
      <SummaryStrip
        items={[
          {
            detail: session?.user.email ?? undefined,
            icon: UserCircle,
            label: 'Compte',
            tone: 'info',
            value: session?.user.roles.includes('SUPER_ADMIN') ? 'Plateforme' : 'Groupement',
          },
          {
            detail: session?.user.roles.map((role) => USER_ROLE_LABELS[role]).join(', '),
            icon: ShieldCheck,
            label: 'Droits',
            tone: 'good',
            value: session?.user.roles.length ?? '-',
          },
          {
            detail: session?.user.groupementName ?? groupementId ?? 'Aucun groupement sélectionné',
            icon: Building2,
            label: 'Contexte',
            value: groupementId ? 'Actif' : 'Plateforme',
          },
          {
            detail: 'Déconnexion après changement',
            icon: KeyRound,
            label: 'Sécurité',
            tone: 'warning',
            value: 'Mot de passe',
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <DataPanel title="Session">
          {meQuery.isLoading && <LoadingState />}
          {meQuery.isError && (
            <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />
          )}
          {meQuery.data && (
            <div className="grid gap-3 text-sm">
              <DetailRow label="Email" value={meQuery.data.email} />
              <DetailRow
                label="Rôles"
                value={meQuery.data.roles.map((role) => USER_ROLE_LABELS[role]).join(', ')}
              />
              <DetailRow label="Groupement" value={meQuery.data.groupementName ?? meQuery.data.groupementId ?? '-'} mono={!meQuery.data.groupementName} />
              <DetailRow label="Chauffeur" value={meQuery.data.driverIdentifier ?? '-'} mono />
            </div>
          )}
        </DataPanel>

        <DataPanel title="Groupement">
          {!groupementId && (
            <p className="text-sm text-muted-foreground">Aucun groupement sélectionné.</p>
          )}
          {groupementId && !isSuperAdmin && (
            <div className="grid gap-3 text-sm">
              <DetailRow label="Groupement courant" value={session?.user.groupementName ?? groupementId} mono={!session?.user.groupementName} />
            </div>
          )}
          {groupementQuery.isLoading && <LoadingState />}
          {groupementQuery.isError && (
            <ErrorState
              error={groupementQuery.error}
              onRetry={() => void groupementQuery.refetch()}
            />
          )}
          {groupementQuery.data && (
            <div className="grid gap-3 text-sm">
              <DetailRow label="Nom" value={groupementQuery.data.name} />
              <DetailRow label="Code" value={groupementQuery.data.code} mono />
              <DetailRow label="Ville" value={groupementQuery.data.city} />
              <DetailRow
                label="Dernière mise à jour"
                value={formatDateTime(groupementQuery.data.updatedAt)}
              />
              <DetailRow
                label="Sonnerie"
                value={`${groupementQuery.data.settings?.ringTimeoutSeconds ?? '-'} s`}
              />
              <DetailRow
                label="Distribution"
                value={
                  groupementQuery.data.settings?.dispatchPolicy
                    ? DISPATCH_POLICY_LABELS[groupementQuery.data.settings.dispatchPolicy]
                    : '-'
                }
              />
            </div>
          )}
        </DataPanel>
      </div>
    </PageShell>
  );
}
