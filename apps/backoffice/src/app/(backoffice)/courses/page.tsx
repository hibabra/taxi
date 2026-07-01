'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseStatus, CreateCoursePayload } from '@taxikiwi/shared-types';
import { CalendarDays, CheckCircle2, CircleDollarSign, Route, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { ListPagination } from '@/components/backoffice/list-pagination';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { CourseFormDialog } from '@/components/features/backoffice/course-form-dialog';
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
import { listClients } from '@/lib/api/clients.api';
import { createCourse, deleteCourse, listCourses } from '@/lib/api/courses.api';
import { listDrivers } from '@/lib/api/drivers.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { COURSE_STATUS_LABELS, formatDistance, formatMoney } from '@/lib/backoffice-labels';
import { formatDateTime } from '@/lib/format';

const allStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export default function CoursesPage() {
  const [page, setPage] = useState(1);
  const [startedFrom, setStartedFrom] = useState('');
  const [startedTo, setStartedTo] = useState('');
  const [status, setStatus] = useState<CourseStatus | 'ALL'>('ALL');
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();
  const filters = {
    limit: 20,
    page,
    startedFrom: startedFrom ? new Date(`${startedFrom}T00:00:00`).toISOString() : undefined,
    startedTo: startedTo ? new Date(`${startedTo}T23:59:59`).toISOString() : undefined,
    status: status === 'ALL' ? undefined : status,
  };

  const coursesQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listCourses(client, filters),
    queryKey: queryKeys.courses(groupementId ?? 'none', filters),
  });

  const driversQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listDrivers(client, { limit: 100, page: 1, status: 'ACTIVE' }),
    queryKey: queryKeys.drivers(groupementId ?? 'none', { courseForm: true }),
  });

  const clientsQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listClients(client, { limit: 100, page: 1 }),
    queryKey: queryKeys.clients(groupementId ?? 'none', { courseForm: true }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCoursePayload) => createCourse(client, payload),
    onSuccess: async () => {
      toast.success('Course enregistrée');
      await queryClient.invalidateQueries({ queryKey: ['courses', groupementId] });
    },
    onError: (error) => {
      toast.error('Saisie refusée', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => deleteCourse(client, courseId),
    onSuccess: async () => {
      toast.success('Course supprimée');
      await queryClient.invalidateQueries({ queryKey: ['courses', groupementId] });
    },
    onError: (error) => {
      toast.error('Suppression impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Courses">
        <TenantRequired />
      </PageShell>
    );
  }

  return (
    <PageShell
      actions={
        <CourseFormDialog
          clients={clientsQuery.data?.data ?? []}
          drivers={driversQuery.data?.data ?? []}
          loading={createMutation.isPending}
          onCreate={(payload) => createMutation.mutateAsync(payload)}
        />
      }
      eyebrow="Groupement"
      title="Courses"
    >
      <SummaryStrip
        items={[
          {
            icon: Route,
            label: 'Courses',
            tone: 'info',
            value: coursesQuery.data?.meta.total ?? '-',
          },
          {
            detail: 'Dans la page courante',
            icon: CheckCircle2,
            label: 'Terminées',
            tone: 'good',
            value:
              coursesQuery.data?.data.filter((course) => course.status === 'COMPLETED').length ??
              '-',
          },
          {
            detail: `${formatDistance(
              coursesQuery.data?.data.reduce((total, course) => total + course.distanceKm, 0) ?? 0,
            )} km affichés`,
            icon: CircleDollarSign,
            label: 'Montant affiché',
            tone: 'good',
            value: formatMoney(
              coursesQuery.data?.data.reduce((total, course) => total + (course.amountEur ?? 0), 0),
            ),
          },
          {
            detail: 'Annulations et clients absents',
            icon: XCircle,
            label: 'Non réalisées',
            tone: 'warning',
            value:
              coursesQuery.data?.data.filter((course) => course.status !== 'COMPLETED').length ??
              '-',
          },
        ]}
      />
      <DataPanel>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            Filtres
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1);
              setStatus(value as CourseStatus | 'ALL');
            }}
          >
            <SelectTrigger className="lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {allStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {COURSE_STATUS_LABELS[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="lg:w-48"
            type="date"
            value={startedFrom}
            onChange={(event) => {
              setPage(1);
              setStartedFrom(event.target.value);
            }}
          />
          <Input
            className="lg:w-48"
            type="date"
            value={startedTo}
            onChange={(event) => {
              setPage(1);
              setStartedTo(event.target.value);
            }}
          />
        </div>
        {coursesQuery.isLoading && <LoadingState />}
        {coursesQuery.isError && (
          <ErrorState error={coursesQuery.error} onRetry={() => void coursesQuery.refetch()} />
        )}
        {coursesQuery.data?.data.length === 0 && (
          <EmptyState
            title="Aucune course"
            message="Aucune course ne correspond aux filtres actuels."
          />
        )}
        {coursesQuery.data && coursesQuery.data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Début</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coursesQuery.data.data.map((course) => {
                const statusItem = COURSE_STATUS_LABELS[course.status];

                return (
                  <TableRow key={course.id}>
                    <TableCell className="max-w-72 whitespace-normal">
                      {course.pickupAddress}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {course.dropoffAddress}
                    </TableCell>
                    <TableCell>{formatDistance(course.distanceKm)} km</TableCell>
                    <TableCell>{course.durationMinutes} min</TableCell>
                    <TableCell>{formatMoney(course.amountEur)}</TableCell>
                    <TableCell>
                      <Badge variant={statusItem.tone}>{statusItem.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(course.startedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm('Supprimer cette course saisie manuellement ?')) {
                            deleteMutation.mutate(course.id);
                          }
                        }}
                      >
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {coursesQuery.data && (
          <ListPagination meta={coursesQuery.data.meta} onPageChange={setPage} />
        )}
      </DataPanel>
    </PageShell>
  );
}
