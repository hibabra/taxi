'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

import { EmptyState, ErrorState, LoadingState } from '@/components/backoffice/api-state';
import { DataPanel, PageShell } from '@/components/backoffice/page-shell';
import { SummaryStrip } from '@/components/backoffice/summary-strip';
import { TenantRequired } from '@/components/backoffice/tenant-required';
import { Button } from '@/components/ui/button';
import { getAllPositions, updatePosition } from '@/lib/api/geolocation.api';
import type { DriverPosition } from '@/lib/api/geolocation.api';
import { listStations } from '@/lib/api/stations.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient, useEffectiveGroupementId } from '@/lib/api/use-api-client';
import { useGeolocationSocket } from '@/lib/hooks/use-geolocation-socket';

const DriversMap = dynamic(
  () => import('@/components/features/backoffice/drivers-map').then((m) => m.DriversMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border bg-muted">
        <p className="text-muted-foreground">Chargement de la carte...</p>
      </div>
    ),
  },
);

export default function CartePage() {
  const groupementId = useEffectiveGroupementId();
  const client = useApiClient(groupementId);
  const watchIdRef = useRef<number | null>(null);

  // ─── Positions en temps réel (merge polling + WebSocket) ───
  const [realtimePositions, setRealtimePositions] = useState<DriverPosition[]>([]);

  // ─── Envoi position GPS en temps réel ───────────────────
 // useEffect(() => {
//   if (!groupementId || !navigator.geolocation) return;

//   watchIdRef.current = navigator.geolocation.watchPosition(
//     (pos) => {
//       void updatePosition(client, {
//         latitude: pos.coords.latitude,
//         longitude: pos.coords.longitude,
//         accuracy: pos.coords.accuracy,
//         status: 'STATION',
//       });
//     },
//     (err) => console.warn('Géolocalisation refusée :', err.message),
//     { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
//   );

//   return () => {
//     if (watchIdRef.current !== null) {
//       navigator.geolocation.clearWatch(watchIdRef.current);
//     }
//   };
// }, [groupementId, client]);

  // ─── Chargement initial via HTTP ────────────────────────
  const positionsQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => getAllPositions(client),
    queryKey: queryKeys.positions(groupementId ?? 'none'),
    // Plus de refetchInterval — le WebSocket prend le relais
  });

  // Initialise realtimePositions quand le fetch HTTP arrive
  useEffect(() => {
    if (positionsQuery.data) {
      setRealtimePositions(positionsQuery.data);
    }
  }, [positionsQuery.data]);

  // ─── WebSocket : mise à jour en temps réel ──────────────
  const handlePositionUpdate = useCallback((updated: DriverPosition) => {
    setRealtimePositions((prev) => {
      const idx = prev.findIndex((p) => p.driverId === updated.driverId);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  useGeolocationSocket({
    groupementId,
    onPositionUpdate: handlePositionUpdate,
  });

  const stationsQuery = useQuery({
    enabled: Boolean(groupementId),
    queryFn: () => listStations(client),
    queryKey: queryKeys.stations(groupementId ?? 'none'),
  });

  if (!groupementId) {
    return (
      <PageShell eyebrow="Groupement" title="Carte">
        <TenantRequired />
      </PageShell>
    );
  }

  const positions = realtimePositions;
  const stations = stationsQuery.data ?? [];
  const libreCount = positions.filter((p) => p.status === 'LIBRE').length;
  const courseCount = positions.filter((p) => p.status === 'COURSE').length;
  const stationCount = positions.filter((p) => p.status === 'STATION').length;

  return (
    <PageShell eyebrow="Groupement" title="Carte temps réel">
      <SummaryStrip
        items={[
          { icon: MapPin, label: 'Chauffeurs connectés', tone: 'info',    value: positions.length },
          { icon: MapPin, label: 'Libres',               tone: 'good',    value: libreCount },
          { icon: MapPin, label: 'En course',            tone: 'warning', value: courseCount },
          { icon: MapPin, label: 'En station',           tone: 'info',    value: stationCount },
        ]}
      />

      <DataPanel title="Carte temps réel">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-green-500 inline-block" />
              <span className="text-xs text-muted-foreground">Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-red-500 inline-block" />
              <span className="text-xs text-muted-foreground">Course</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-xs text-muted-foreground">Station</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-gray-500 inline-block" />
              <span className="text-xs text-muted-foreground">Absent</span>
            </div>
            <span className="text-muted-foreground/30">|</span>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-orange-500 inline-block" />
              <span className="text-xs text-muted-foreground">Stations ({stations.length})</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void positionsQuery.refetch();
              void stationsQuery.refetch();
            }}
          >
            <RefreshCw className="size-4 mr-1" />
            Rafraîchir
          </Button>
        </div>

        {positionsQuery.isLoading && <LoadingState />}
        {positionsQuery.isError && (
          <ErrorState error={positionsQuery.error} onRetry={() => void positionsQuery.refetch()} />
        )}

        {!positionsQuery.isLoading && (
          <>
            {positions.length === 0 && stations.length === 0 && (
              <div className="mb-4">
                <EmptyState title="Aucun élément à afficher" message="Aucun chauffeur connecté ni station créée." />
              </div>
            )}
            <DriversMap positions={positions} stations={stations} />
          </>
        )}
      </DataPanel>
    </PageShell>
  );
}