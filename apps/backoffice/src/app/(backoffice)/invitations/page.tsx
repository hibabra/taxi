'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  CreateDriverInvitationPayload,
  CreateUserInvitationPayload,
} from '@taxikiwi/shared-types';
import { BellPlus, Car, Users } from 'lucide-react';
import { toast } from 'sonner';

import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { DriverInvitationForm } from '@/components/features/backoffice/driver-invitation-form';
import { UserInvitationDialog } from '@/components/features/backoffice/user-invitation-dialog';
import { createDriverInvitation } from '@/lib/api/drivers.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { createUserInvitation } from '@/lib/api/users.api';
import { formatDateTime } from '@/lib/format';

export default function InvitationsPage() {
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);

  const inviteMutation = useMutation({
    mutationFn: (payload: CreateDriverInvitationPayload) => createDriverInvitation(client, payload),
    onSuccess: (invitation) => {
      toast.success('Invitation chauffeur envoyee', {
        description: `Expire le ${formatDateTime(invitation.expiresAt)}`,
      });
    },
    onError: (error) => {
      toast.error('Invitation refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const userInviteMutation = useMutation({
    mutationFn: (payload: CreateUserInvitationPayload) => createUserInvitation(client, payload),
    onSuccess: (invitation) => {
      toast.success('Invitation utilisateur envoyée', {
        description: `Expire le ${formatDateTime(invitation.expiresAt)}`,
      });
    },
    onError: (error) => {
      toast.error('Invitation utilisateur refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Invitations">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Groupement" title="Invitations">
      <SummaryStrip
        items={[
          {
            detail: 'Finalise son compte mobile',
            icon: Car,
            label: 'Chauffeur',
            tone: 'good',
            value: 'Taxi',
          },
          {
            detail: 'Accès backoffice groupement',
            icon: Users,
            label: 'Utilisateur',
            tone: 'info',
            value: 'Admin',
          },
          {
            detail: 'Expiration communiquée après envoi',
            icon: BellPlus,
            label: 'Suivi',
            value: 'Audit',
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <DataPanel title="Inviter un chauffeur">
          <DriverInvitationForm
            loading={inviteMutation.isPending}
            onInvite={(payload) => inviteMutation.mutateAsync(payload)}
          />
        </DataPanel>
        <DataPanel title="Inviter un utilisateur backoffice">
          <div className="flex min-h-32 flex-col justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Pour inviter un administrateur du groupement.
            </p>
            <UserInvitationDialog
              loading={userInviteMutation.isPending}
              onInvite={(payload) => userInviteMutation.mutateAsync(payload)}
            />
          </div>
        </DataPanel>
      </div>
    </PageShell>
  );
}
