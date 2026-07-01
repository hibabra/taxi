'use client';

import { useEffect, useRef, useState } from 'react';
import type { DriverPosition } from '@/lib/api/geolocation.api';
import type { Station } from '@/lib/api/stations.api';

type DriverAvailabilityStatus =
  | 'LIBRE'
  | 'COURSE'
  | 'ABSENT'
  | 'HORS_SERVICE'
  | 'STATION';

const STATUS_COLORS: Record<DriverAvailabilityStatus, string> = {
  LIBRE: '#22c55e',
  COURSE: '#ef4444',
  ABSENT: '#6b7280',
  HORS_SERVICE: '#111827',
  STATION: '#3b82f6',
};

const STATUS_LABELS: Record<DriverAvailabilityStatus, string> = {
  LIBRE: 'Libre',
  COURSE: 'En course',
  ABSENT: 'Absent',
  HORS_SERVICE: 'Hors service',
  STATION: 'En station',
};

interface DriversMapProps {
  positions: DriverPosition[];
  stations?: Station[];
}

export function DriversMap({ positions, stations = [] }: DriversMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').CircleMarker[]>([]);
  const stationLayersRef = useRef<import('leaflet').Layer[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Dérive le selectedDriver depuis positions (toujours à jour)
  const selectedDriver = selectedDriverId
    ? (positions.find((p) => p.driverId === selectedDriverId) ?? null)
    : null;

  // ─── Initialiser la carte ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    void import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current).setView([48.8566, 2.3522], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── Affichage des stations ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    void import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      stationLayersRef.current.forEach((layer) => layer.remove());
      stationLayersRef.current = [];

      stations.forEach((station) => {
        if (!station.isActive) return;

        if (
          station.type === 'CIRCLE' &&
          station.latitude != null &&
          station.longitude != null
        ) {
          const lat = Number(station.latitude);
          const lng = Number(station.longitude);

          const circle = L.circle([lat, lng], {
            radius: station.radiusMeters ?? 50,
            fillColor: '#f97316',
            color: '#ea580c',
            weight: 2,
            fillOpacity: 0.25,
          });
          circle.addTo(map);
          stationLayersRef.current.push(circle);

          const center = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: '#f97316',
            color: '#ffffff',
            weight: 3,
            fillOpacity: 1,
          });
          center.bindPopup(`<div style="font-family:sans-serif;"><strong>📍 ${station.name}</strong></div>`);
          center.addTo(map);
          stationLayersRef.current.push(center);
        } else if (
          station.type === 'POLYGON' &&
          station.polygonPoints &&
          station.polygonPoints.length >= 3
        ) {
          const polygon = L.polygon(
            station.polygonPoints.map((p) => [p.lat, p.lng]),
            { fillColor: '#f97316', color: '#ea580c', weight: 2, fillOpacity: 0.25 },
          );
          polygon.addTo(map);
          stationLayersRef.current.push(polygon);
        }
      });

      const stationCoords = stations
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => [Number(s.latitude), Number(s.longitude)]) as [number, number][];

      if (stationCoords.length > 0) {
        const bounds = L.latLngBounds(stationCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [stations, mapReady]);

  // ─── Affichage des chauffeurs (temps réel) ───────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    void import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      positions.forEach((position) => {
        const status = (position.status as DriverAvailabilityStatus) ?? 'ABSENT';
        const color = STATUS_COLORS[status] ?? STATUS_COLORS.ABSENT;

        const marker = L.circleMarker(
          [position.latitude, position.longitude],
          {
            radius: 12,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          },
        );

        // Stocke le driverId au lieu de la position entière
        marker.on('click', () => {
          setSelectedDriverId(position.driverId);
        });

        marker.addTo(map);
        markersRef.current.push(marker);
      });
    });
  }, [positions, mapReady]);

  // ─── Formater la date ────────────────────────────────────
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const selectedStatus = selectedDriver
    ? ((selectedDriver.status as DriverAvailabilityStatus) ?? 'ABSENT')
    : 'ABSENT';

  return (
    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
      <div
        ref={mapRef}
        style={{
          height: selectedDriver ? '400px' : '500px',
          width: '100%',
          transition: 'height 0.3s ease',
        }}
      />

      {selectedDriver && (
        <div
          style={{
            background: '#ffffff',
            borderTop: '1px solid #e5e7eb',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 22,
              marginBottom: 4,
            }}>
              👤
            </div>
            <button style={btnStyle('#1d4ed8')}>💬 Envoyer un message</button>
            <button style={btnStyle('#1d4ed8')}>ℹ️ Informations du taxi</button>
            <button style={btnStyle('#1d4ed8')}>🕐 Historique du taxi</button>
            <button onClick={() => setSelectedDriverId(null)} style={btnStyle('#eab308', '#000')}>
              ✖ Fermer
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
              Chauffeur #{selectedDriver.driverId.slice(0, 8)}...
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
              <p style={infoStyle}>
                <span style={{ color: '#6b7280' }}>Statut : </span>
                <strong style={{ color: STATUS_COLORS[selectedStatus] }}>
                  {STATUS_LABELS[selectedStatus]}
                </strong>
              </p>
              <p style={infoStyle}>
                <span style={{ color: '#6b7280' }}>Latitude : </span>
                {Number(selectedDriver.latitude).toFixed(5)}

              </p>
              <p style={infoStyle}>
                <span style={{ color: '#6b7280' }}>Dernière position : </span>
                {formatDate(selectedDriver.recordedAt as string)}
              </p>
              <p style={infoStyle}>
                <span style={{ color: '#6b7280' }}>Longitude : </span>
                {Number(selectedDriver.longitude).toFixed(5)}

              </p>
              {selectedDriver.speed != null && (
                <p style={infoStyle}>
                  <span style={{ color: '#6b7280' }}>Vitesse : </span>
                  {selectedDriver.speed} km/h
                </p>
              )}
              {selectedDriver.heading != null && (
                <p style={infoStyle}>
                  <span style={{ color: '#6b7280' }}>Direction : </span>
                  {selectedDriver.heading}°
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg: string, color = 'white'): React.CSSProperties => ({
  background: bg,
  color,
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'left',
  width: '100%',
});

const infoStyle: React.CSSProperties = {
  margin: '2px 0',
  fontSize: 14,
  color: '#111827',
};