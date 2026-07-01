'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStationPayload } from '@taxikiwi/shared-types';
import {
  Circle,
  Edit3,
  Hexagon,
  Layers,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/backoffice/api-state';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { StationFormDialog } from '@/components/features/backoffice/station-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  listStations,
  createStation,
  deleteStation,
} from '@/lib/api/stations.api';
import { getZone, updateZone } from '@/lib/api/zone.api';
import { queryKeys } from '@/lib/api/query-keys';
import {
  useApiClient,
  useEffectiveGroupementId,
} from '@/lib/api/use-api-client';
import { userFacingApiMessage } from '@/lib/api/errors';
import type {
  DrawMode,
  ZoneGeometry,
  StationOverlay,
} from '@/components/features/backoffice/zone-station-map';

// Dynamic import to avoid SSR issues with Leaflet
const ZoneStationMap = dynamic(
  () =>
    import('@/components/features/backoffice/zone-station-map').then(
      (m) => m.ZoneStationMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border bg-muted">
        <p className="text-muted-foreground">Chargement de la carte…</p>
      </div>
    ),
  },
);

// ── Main Page Component ──────────────────────────────────────

export default function ZonesStationsPage() {
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ── Drawing state ──────────────────────────────────────────
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawingTarget, setDrawingTarget] = useState<'zone' | 'station'>('zone');
  const [editMode, setEditMode] = useState(false);
  const [pendingStationGeometry, setPendingStationGeometry] = useState<{
    type: 'CIRCLE' | 'POLYGON';
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    polygonPoints?: { lat: number; lng: number }[];
  } | null>(null);

  // ── Queries ────────────────────────────────────────────────

  const zoneQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => getZone(client),
    queryKey: queryKeys.zone(groupementId ?? 'none'),
  });

  const stationsQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listStations(client),
    queryKey: queryKeys.stations(groupementId ?? 'none'),
  });

  // ── Mutations ──────────────────────────────────────────────

  const zoneMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateZone>[1]) =>
      updateZone(client, payload),
    onSuccess: async () => {
      toast.success('Zone mise à jour');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.zone(groupementId ?? 'none'),
      });
    },
    onError: (error) => {
      toast.error('Mise à jour de la zone impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const createStationMutation = useMutation({
    mutationFn: (dto: CreateStationPayload) => createStation(client, dto),
    onSuccess: async () => {
      toast.success('Station créée');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.stations(groupementId ?? 'none'),
      });
    },
    onError: (error) => {
      toast.error('Création impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  const deleteStationMutation = useMutation({
    mutationFn: (stationId: string) => deleteStation(client, stationId),
    onSuccess: async () => {
      toast.success('Station supprimée');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.stations(groupementId ?? 'none'),
      });
    },
    onError: (error) => {
      toast.error('Suppression impossible', {
        description: userFacingApiMessage(error),
      });
    },
  });

  // ── Handlers ───────────────────────────────────────────────

  const handleZoneChange = useCallback(
    (zoneData: ZoneGeometry) => {
      setDrawMode('none');
      setEditMode(false);
      zoneMutation.mutate({
        zoneType: zoneData.type,
        zoneLatitude: zoneData.latitude ?? null,
        zoneLongitude: zoneData.longitude ?? null,
        zoneRadiusMeters: zoneData.radiusMeters ?? null,
        zonePolygonPoints: zoneData.polygonPoints ?? null,
        zoneColor: zoneData.color,
      });
    },
    [zoneMutation],
  );

  const handleStationDraw = useCallback(
    (geometry: {
      type: 'CIRCLE' | 'POLYGON';
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      polygonPoints?: { lat: number; lng: number }[];
    }) => {
      setDrawMode('none');
      setPendingStationGeometry(geometry);
    },
    [],
  );

  const handleStationClick = useCallback((stationId: string) => {
    const el = document.getElementById(`station-row-${stationId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-accent/40');
      setTimeout(() => el.classList.remove('bg-accent/40'), 2000);
    }
  }, []);

  const startDrawingZone = useCallback((mode: 'polygon' | 'circle') => {
    setDrawingTarget('zone');
    setDrawMode(mode);
    setEditMode(false);
    setPendingStationGeometry(null);
  }, []);

  const startDrawingStation = useCallback((mode: 'polygon' | 'circle') => {
    setDrawingTarget('station');
    setDrawMode(mode);
    setEditMode(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
    setDrawMode('none');
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawMode('none');
    setEditMode(false);
    setPendingStationGeometry(null);
  }, []);

  const finalizePolygonDrawing = useCallback(() => {
    const mapEl = document.getElementById('zone-station-map') as
      (HTMLDivElement & { _finalizePolygon?: () => void }) | null;
    if (mapEl?._finalizePolygon) {
      mapEl._finalizePolygon();
    }
  }, []);

  const deleteZone = useCallback(() => {
    zoneMutation.mutate({
      zoneType: null,
      zoneLatitude: null,
      zoneLongitude: null,
      zoneRadiusMeters: null,
      zonePolygonPoints: null,
    });
  }, [zoneMutation]);

  // ── Early returns ──────────────────────────────────────────

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Zones & Stations">
        <TenantRequired />
      </PageShell>
    );
  }

  // ── Derived data ───────────────────────────────────────────

  const zoneData = zoneQuery.data;
  const stations = stationsQuery.data ?? [];

  const zoneGeometry: ZoneGeometry | null =
    zoneData?.zoneType
      ? {
          type: zoneData.zoneType as 'CIRCLE' | 'POLYGON',
          latitude: zoneData.zoneLatitude,
          longitude: zoneData.zoneLongitude,
          radiusMeters: zoneData.zoneRadiusMeters,
          polygonPoints: zoneData.zonePolygonPoints,
          color: zoneData.zoneColor ?? '#3b82f6',
        }
      : null;

  const stationOverlays: StationOverlay[] = stations.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type as 'CIRCLE' | 'POLYGON',
    latitude: s.latitude,
    longitude: s.longitude,
    radiusMeters: s.radiusMeters,
    polygonPoints: s.polygonPoints,
    isActive: s.isActive,
  }));

  const circles = stations.filter((s) => s.type === 'CIRCLE');
  const polygons = stations.filter((s) => s.type === 'POLYGON');
  const isDrawing = drawMode !== 'none';
  const isLoading = zoneQuery.isLoading || stationsQuery.isLoading;

  return (
    <PageShell eyebrow="Groupement" title="Zones & Stations">
      {/* Summary strip */}
      <SummaryStrip
        items={[
          {
            icon: Layers,
            label: 'Zone',
            tone: zoneGeometry ? 'good' : 'info',
            value: zoneGeometry
              ? zoneGeometry.type === 'CIRCLE'
                ? 'Cercle'
                : 'Polygone'
              : 'Non définie',
          },
          {
            icon: MapPin,
            label: 'Stations',
            tone: 'info',
            value: stations.length,
          },
          {
            icon: Circle,
            label: 'Cercles',
            tone: 'good',
            value: circles.length,
          },
          {
            icon: Hexagon,
            label: 'Polygones',
            tone: 'info',
            value: polygons.length,
          },
        ]}
      />

      {/* Loading / Error states */}
      {isLoading && <LoadingState />}
      {zoneQuery.isError && (
        <ErrorState
          error={zoneQuery.error}
          onRetry={() => void zoneQuery.refetch()}
        />
      )}

      {!isLoading && !zoneQuery.isError && (
        <>
          {/* ── Toolbar ──────────────────────────────────────── */}
          <DataPanel title="Carte interactive">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Zone drawing controls */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                <span className="px-2 text-xs font-semibold uppercase text-muted-foreground">
                  Zone
                </span>
                <Button
                  size="sm"
                  variant={
                    drawMode === 'polygon' && drawingTarget === 'zone'
                      ? 'default'
                      : 'secondary'
                  }
                  onClick={() => startDrawingZone('polygon')}
                  disabled={zoneMutation.isPending}
                >
                  <Hexagon className="mr-1 size-3.5" />
                  Polygone
                </Button>
                <Button
                  size="sm"
                  variant={
                    drawMode === 'circle' && drawingTarget === 'zone'
                      ? 'default'
                      : 'secondary'
                  }
                  onClick={() => startDrawingZone('circle')}
                  disabled={zoneMutation.isPending}
                >
                  <Circle className="mr-1 size-3.5" />
                  Cercle
                </Button>
              </div>

              {/* Station drawing controls */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                <span className="px-2 text-xs font-semibold uppercase text-muted-foreground">
                  Station
                </span>
                <Button
                  size="sm"
                  variant={
                    drawMode === 'polygon' && drawingTarget === 'station'
                      ? 'default'
                      : 'secondary'
                  }
                  onClick={() => startDrawingStation('polygon')}
                >
                  <Hexagon className="mr-1 size-3.5" />
                  Polygone
                </Button>
                <Button
                  size="sm"
                  variant={
                    drawMode === 'circle' && drawingTarget === 'station'
                      ? 'default'
                      : 'secondary'
                  }
                  onClick={() => startDrawingStation('circle')}
                >
                  <Circle className="mr-1 size-3.5" />
                  Cercle
                </Button>
              </div>

              {/* Edit / Delete controls */}
              <div className="flex items-center gap-1">
                {zoneGeometry && (
                  <>
                    <Button
                      size="sm"
                      variant={editMode ? 'default' : 'outline'}
                      onClick={toggleEditMode}
                    >
                      <Edit3 className="mr-1 size-3.5" />
                      Éditer les points
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deleteZone}
                      disabled={zoneMutation.isPending}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Supprimer la zone
                    </Button>
                  </>
                )}
              </div>

              {/* Active drawing indicator */}
              {isDrawing && (
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="default" className="animate-pulse">
                    {drawMode === 'polygon'
                      ? 'Cliquez pour placer les points du polygone'
                      : 'Cliquez pour le centre, puis pour le rayon'}
                  </Badge>
                  {drawMode === 'polygon' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={finalizePolygonDrawing}
                    >
                      <Save className="mr-1 size-3.5" />
                      Valider le polygone
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={cancelDrawing}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* ── Map ────────────────────────────────────────── */}
            <div
              ref={mapContainerRef}
              className="relative overflow-hidden rounded-lg border border-border"
            >
              <ZoneStationMap
                zone={zoneGeometry}
                stations={stationOverlays}
                onZoneChange={handleZoneChange}
                onStationDraw={handleStationDraw}
                onStationClick={handleStationClick}
                drawMode={drawMode}
                drawingTarget={drawingTarget}
                editMode={editMode}
              />
            </div>
          </DataPanel>

          {/* ── Pending station creation dialog ──────────────── */}
          {pendingStationGeometry && (
            <PendingStationDialog
              geometry={pendingStationGeometry}
              loading={createStationMutation.isPending}
              onCancel={() => setPendingStationGeometry(null)}
              onCreate={async (name, description, address) => {
                const payload: CreateStationPayload = {
                  name,
                  description: description || undefined,
                  address: address || undefined,
                  type: pendingStationGeometry.type,
                  latitude: pendingStationGeometry.latitude,
                  longitude: pendingStationGeometry.longitude,
                  radiusMeters: pendingStationGeometry.radiusMeters,
                  polygonPoints: pendingStationGeometry.polygonPoints,
                };
                await createStationMutation.mutateAsync(payload);
                setPendingStationGeometry(null);
              }}
            />
          )}

          {/* ── Stations table ───────────────────────────────── */}
          <DataPanel
            title="Liste des stations"
            action={
              <StationFormDialog
                loading={createStationMutation.isPending}
                onCreate={(payload) =>
                  createStationMutation.mutateAsync(payload)
                }
              />
            }
          >
            {stationsQuery.isLoading && <LoadingState />}
            {stationsQuery.isError && (
              <ErrorState
                error={stationsQuery.error}
                onRetry={() => void stationsQuery.refetch()}
              />
            )}
            {stations.length === 0 && !stationsQuery.isLoading && (
              <EmptyState
                title="Aucune station"
                message="Dessinez une station sur la carte ou créez-en une manuellement."
              />
            )}
            {stations.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Détails</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations.map((station) => (
                    <TableRow
                      key={station.id}
                      id={`station-row-${station.id}`}
                      className="transition-colors duration-500"
                    >
                      <TableCell className="font-medium">
                        {station.name}
                        {station.description && (
                          <div className="text-xs text-muted-foreground">
                            {station.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            station.type === 'CIRCLE' ? 'default' : 'secondary'
                          }
                        >
                          {station.type === 'CIRCLE' ? 'Cercle' : 'Polygone'}
                        </Badge>
                      </TableCell>
                      <TableCell>{station.address ?? '—'}</TableCell>
                      <TableCell>
                        {station.type === 'CIRCLE'
                          ? `${station.radiusMeters}m`
                          : `${station.polygonPoints?.length ?? 0} points`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            station.isActive ? 'default' : 'secondary'
                          }
                        >
                          {station.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteStationMutation.isPending}
                          onClick={() =>
                            deleteStationMutation.mutate(station.id)
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataPanel>
        </>
      )}
    </PageShell>
  );
}

// ── Pending Station Dialog ───────────────────────────────────

function PendingStationDialog({
  geometry,
  loading,
  onCancel,
  onCreate,
}: {
  geometry: {
    type: 'CIRCLE' | 'POLYGON';
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    polygonPoints?: { lat: number; lng: number }[];
  };
  loading: boolean;
  onCancel: () => void;
  onCreate: (name: string, description: string, address: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          Nouvelle station (
          {geometry.type === 'CIRCLE' ? 'Cercle' : 'Polygone'})
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {geometry.type === 'CIRCLE'
            ? `Centre: ${geometry.latitude?.toFixed(5)}, ${geometry.longitude?.toFixed(5)} — Rayon: ${geometry.radiusMeters}m`
            : `${geometry.polygonPoints?.length ?? 0} points`}
        </p>

        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Nom de la station *
            </label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ex: Gare de Sèvres"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Adresse
            </label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ex: 18 Rue de Dunkerque"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ex: Station principale"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button
            disabled={!name.trim() || loading}
            onClick={() => void onCreate(name, description, address)}
          >
            <Plus className="mr-1 size-4" />
            Créer la station
          </Button>
        </div>
      </div>
    </div>
  );
}
