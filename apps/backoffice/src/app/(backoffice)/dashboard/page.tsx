'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Car, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { MetricCard } from '@/components/backoffice/metric-card';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { AuditTable } from '@/components/features/backoffice/audit-table';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listAuditLogs } from '@/lib/api/audit.api';
import { listDrivers } from '@/lib/api/drivers.api';
import { listGroupements } from '@/lib/api/groupements.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { DRIVER_STATUS_LABELS } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';

export default function DashboardPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;

  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return <AdminDashboard />;
}

// ─── SUPER ADMIN DASHBOARD ─────────────────────────────────────────────────────

function SuperAdminDashboard() {
  const groupementId = useEffectiveGroupementId();
  const platformClient = useApiClient(null);
  const tenantClient = useApiClient(groupementId);

  const groupementsQuery = useQuery({
    queryFn: () => listGroupements(platformClient, { limit: 5, page: 1 }),
    queryKey: queryKeys.groupements({ dashboard: true }),
  });

  const auditQuery = useQuery({
    queryFn: () =>
      listAuditLogs(platformClient, {
        groupementId: groupementId ?? undefined,
        limit: 10,
        page: 1,
      }),
    queryKey: queryKeys.audit({ dashboard: true, groupementId: groupementId ?? 'platform' }),
  });

  const driversQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listDrivers(tenantClient, { limit: 100, page: 1 }),
    queryKey: queryKeys.drivers(groupementId ?? 'none', { dashboard: true }),
  });

  const driverStats = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];
    return {
      active: drivers.filter((d) => d.status === 'ACTIVE').length,
      suspended: drivers.filter((d) => d.status === 'SUSPENDED').length,
      total: driversQuery.data?.meta.total ?? 0,
    };
  }, [driversQuery.data]);

  return (
    <PageShell eyebrow="Supervision" title="Dashboard plateforme">
      {/* Métriques plateforme */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Total plateforme"
          icon={Building2}
          label="Groupements"
          tone="green"
          value={groupementsQuery.data?.meta.total ?? '-'}
        />
        <MetricCard
          detail="Journal plateforme"
          icon={ShieldCheck}
          label="Événements audit"
          value={auditQuery.data?.meta.total ?? '-'}
        />
        <MetricCard
          detail={groupementId ? 'Groupement sélectionné' : 'Sélectionnez un groupement'}
          icon={Car}
          label="Chauffeurs"
          value={groupementId ? driverStats.total : '-'}
        />
      </div>

      {/* Audit plateforme */}
      <DataPanel title="Dernières actions plateforme">
        {auditQuery.isLoading && <LoadingState />}
        {auditQuery.isError && (
          <ErrorState error={auditQuery.error} onRetry={() => void auditQuery.refetch()} />
        )}
        {auditQuery.data?.data.length === 0 && (
          <EmptyState title="Aucun audit" message="Aucune action enregistrée pour le moment." />
        )}
        {auditQuery.data && auditQuery.data.data.length > 0 && (
          <AuditTable compact entries={auditQuery.data.data} />
        )}
      </DataPanel>

      {/* Chauffeurs du groupement sélectionné */}
      {!groupementId && <TenantRequired />}
      {groupementId && (
        <>
          <SummaryStrip
            items={[
              {
                detail: 'Chauffeurs prêts à recevoir des courses',
                icon: UserRoundCheck,
                label: 'Actifs',
                tone: 'good',
                value: driverStats.active,
              },
              {
                detail: 'À traiter avant reprise de service',
                icon: AlertTriangle,
                label: 'Suspendus',
                tone: driverStats.suspended > 0 ? 'warning' : 'default',
                value: driverStats.suspended,
              },
            ]}
          />

          <DataPanel title="Chauffeurs du groupement">
            {driversQuery.isLoading && <LoadingState />}
            {driversQuery.isError && (
              <ErrorState error={driversQuery.error} onRetry={() => void driversQuery.refetch()} />
            )}
            {driversQuery.data?.data.length === 0 && (
              <EmptyState
                title="Aucun chauffeur"
                message="Ce groupement n'a pas encore de chauffeur."
              />
            )}
            {driversQuery.data && driversQuery.data.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Activation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driversQuery.data.data.map((driver) => {
                    const status = DRIVER_STATUS_LABELS[driver.status];

                    return (
                      <TableRow key={driver.id}>
                        <TableCell className="font-mono">{driver.driverIdentifier}</TableCell>
                        <TableCell className="font-medium">{`${driver.firstName} ${driver.lastName}`}</TableCell>
                        <TableCell>{driver.phoneE164}</TableCell>
                        <TableCell>
                          <Badge variant={status.tone}>{status.label}</Badge>
                          {driver.isGroupAdmin && (
                            <Badge className="ml-2" variant="secondary">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(driver.mobileActivatedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        </>
      )}
    </PageShell>
  );
}

// ─── ADMIN GROUPEMENT DASHBOARD ─────────────────────────────────────────────────

function AdminDashboard() {
  const groupementId = useEffectiveGroupementId();
  const tenantClient = useApiClient(groupementId);

  const driversQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listDrivers(tenantClient, { limit: 100, page: 1 }),
    queryKey: queryKeys.drivers(groupementId ?? 'none', { dashboard: true }),
  });

  const operations = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];

    return {
      activeDrivers: drivers.filter((d) => d.status === 'ACTIVE').length,
      admins: drivers.filter((d) => d.isGroupAdmin).length,
      suspendedDrivers: drivers.filter((d) => d.status === 'SUSPENDED').length,
      total: driversQuery.data?.meta.total ?? 0,
    };
  }, [driversQuery.data]);

  if (!groupementId) {
    return (
      <PageShell eyebrow="Vue générale" title="Dashboard">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Vue générale" title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Total groupement"
          icon={Car}
          label="Chauffeurs"
          value={operations.total}
        />
        <MetricCard
          detail="Disponibles pour exploitation"
          icon={UserRoundCheck}
          label="Actifs"
          tone="green"
          value={operations.activeDrivers}
        />
        <MetricCard
          detail="À traiter avant reprise"
          icon={AlertTriangle}
          label="Suspendus"
          tone={operations.suspendedDrivers > 0 ? 'green' : undefined}
          value={operations.suspendedDrivers}
        />
        <MetricCard
          detail="Responsables groupement"
          icon={ShieldCheck}
          label="Admins"
          value={operations.admins}
        />
      </div>

      <SummaryStrip
        items={[
          {
            detail: 'Chauffeurs prêts à recevoir des courses',
            icon: UserRoundCheck,
            label: 'Chauffeurs actifs',
            tone: 'good',
            value: operations.activeDrivers,
          },
          {
            detail: 'À traiter avant reprise de service',
            icon: AlertTriangle,
            label: 'Suspendus',
            tone: operations.suspendedDrivers > 0 ? 'warning' : 'default',
            value: operations.suspendedDrivers,
          },
        ]}
      />

      <DataPanel title="Chauffeurs récents">
        {driversQuery.isLoading && <LoadingState />}
        {driversQuery.isError && (
          <ErrorState error={driversQuery.error} onRetry={() => void driversQuery.refetch()} />
        )}
        {driversQuery.data?.data.length === 0 && (
          <EmptyState
            title="Aucun chauffeur"
            message="Votre groupement n'a pas encore de chauffeur."
          />
        )}
        {driversQuery.data && driversQuery.data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identifiant</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Activation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {driversQuery.data.data.slice(0, 8).map((driver) => {
                const status = DRIVER_STATUS_LABELS[driver.status];

                return (
                  <TableRow key={driver.id}>
                    <TableCell className="font-mono">{driver.driverIdentifier}</TableCell>
                    <TableCell className="font-medium">{`${driver.firstName} ${driver.lastName}`}</TableCell>
                    <TableCell>{driver.phoneE164}</TableCell>
                    <TableCell>
                      <Badge variant={status.tone}>{status.label}</Badge>
                      {driver.isGroupAdmin && (
                        <Badge className="ml-2" variant="secondary">
                          Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(driver.mobileActivatedAt)}</TableCell>
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
