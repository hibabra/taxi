'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInvitationPayload, UserRole } from '@taxikiwi/shared-types';
import { Search, ShieldCheck, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { ListPagination } from '@/components/backoffice/list-pagination';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { UserInvitationDialog } from '@/components/features/backoffice/user-invitation-dialog';
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
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { userFacingApiMessage } from '@/lib/api/errors';
import {
  createUserInvitation,
  deactivateUser,
  listUsers,
  requestUserPasswordReset,
} from '@/lib/api/users.api';
import { USER_ROLE_LABELS } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';

export default function UsersPage() {
  const [isActive, setIsActive] = useState<'ACTIVE' | 'ALL' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();
  const filters = {
    isActive: isActive === 'ALL' ? undefined : isActive === 'ACTIVE',
    limit: 20,
    page,
    role: role === 'ALL' ? undefined : role,
    search: search || undefined,
  };

  const usersQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listUsers(client, filters),
    queryKey: queryKeys.users(groupementId ?? 'none', filters),
  });

  const inviteMutation = useMutation({
    mutationFn: (payload: CreateUserInvitationPayload) => createUserInvitation(client, payload),
    onSuccess: async (invitation) => {
      toast.success('Invitation envoyée', {
        description: `Expire le ${formatDateTime(invitation.expiresAt)}`,
      });
      await queryClient.invalidateQueries({ queryKey: ['users', groupementId] });
    },
    onError: (error) => {
      toast.error('Invitation refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(client, userId),
    onSuccess: async () => {
      toast.success('Utilisateur désactivé');
      await queryClient.invalidateQueries({ queryKey: ['users', groupementId] });
    },
    onError: (error) => {
      toast.error('Désactivation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) => requestUserPasswordReset(client, userId),
    onSuccess: (invitation) => {
      toast.success('Réinitialisation envoyée', {
        description: `Expire le ${formatDateTime(invitation.expiresAt)}`,
      });
    },
    onError: (error) => {
      toast.error('Réinitialisation impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Utilisateurs">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell
      actions={
        <UserInvitationDialog
          loading={inviteMutation.isPending}
          onInvite={(payload) => inviteMutation.mutateAsync(payload)}
        />
      }
      eyebrow="Groupement"
      title="Utilisateurs"
    >
      <SummaryStrip
        items={[
          {
            icon: Users,
            label: 'Utilisateurs',
            tone: 'info',
            value: usersQuery.data?.meta.total ?? '-',
          },
          {
            detail: 'Peuvent accéder au backoffice',
            icon: UserRoundCheck,
            label: 'Actifs affichés',
            tone: 'good',
            value: usersQuery.data?.data.filter((user) => user.isActive).length ?? '-',
          },
          {
            detail: 'Accès coupé',
            icon: UserRoundX,
            label: 'Inactifs affichés',
            tone: 'warning',
            value: usersQuery.data?.data.filter((user) => !user.isActive).length ?? '-',
          },
          {
            detail: 'Responsables groupement',
            icon: ShieldCheck,
            label: 'Admins affichés',
            tone: 'good',
            value:
              usersQuery.data?.data.filter((user) => user.roles.includes('ADMIN')).length ?? '-',
          },
        ]}
      />
      <DataPanel>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Nom ou email"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => {
              setPage(1);
              setRole(value as UserRole | 'ALL');
            }}
          >
            <SelectTrigger className="lg:w-56">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les rôles</SelectItem>
                <SelectItem value="ADMIN">{USER_ROLE_LABELS.ADMIN}</SelectItem>
                <SelectItem value="DRIVER">{USER_ROLE_LABELS.DRIVER}</SelectItem>
              </SelectContent>
          </Select>
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
        {usersQuery.isLoading && <LoadingState />}
        {usersQuery.isError && (
          <ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />
        )}
        {usersQuery.data?.data.length === 0 && (
          <EmptyState
            title="Aucun utilisateur"
            message="Aucun utilisateur ne correspond aux filtres actuels."
          />
        )}
        {usersQuery.data && usersQuery.data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{`${user.firstName} ${user.lastName}`}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {USER_ROLE_LABELS[role]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'outline'}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetMutation.mutate(user.id)}
                      >
                        Reset mot de passe
                      </Button>
                      {user.isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deactivateMutation.mutate(user.id)}
                        >
                          Désactiver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {usersQuery.data && <ListPagination meta={usersQuery.data.meta} onPageChange={setPage} />}
      </DataPanel>
    </PageShell>
  );
}
