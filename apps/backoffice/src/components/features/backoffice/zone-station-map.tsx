'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PolygonPoint } from '@taxikiwi/shared-types';

// ── Types ────────────────────────────────────────────────────

type DrawMode = 'none' | 'polygon' | 'circle';

interface ZoneGeometry {
  type: 'CIRCLE' | 'POLYGON';
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  polygonPoints?: PolygonPoint[] | null;
  color: string;
}

interface StationOverlay {
  id: string;
  name: string;
  type: 'CIRCLE' | 'POLYGON';
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  polygonPoints?: PolygonPoint[] | null;
  isActive: boolean;
}

interface ZoneStationMapProps {
  /** Zone geometry of the current groupement */
  zone: ZoneGeometry | null;
  /** Stations to display */
  stations: StationOverlay[];
  /** Called when the zone geometry changes (drawing/editing) */
  onZoneChange: (zone: ZoneGeometry) => void;
  /** Called when a station's geometry is drawn */
  onStationDraw: (geometry: {
    type: 'CIRCLE' | 'POLYGON';
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    polygonPoints?: PolygonPoint[];
  }) => void;
  /** Called when a station is clicked on the map */
  onStationClick?: (stationId: string) => void;
  /** Current drawing mode */
  drawMode: DrawMode;
  /** Whether we are drawing a station (vs zone) */
  drawingTarget: 'zone' | 'station';
  /** Whether editing mode is active (drag points) */
  editMode: boolean;
}

// ── Constants ────────────────────────────────────────────────

const STATION_FILL_COLOR = '#f97316';
const STATION_STROKE_COLOR = '#ea580c';
const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];
const DEFAULT_ZOOM = 11;

// ── Component ────────────────────────────────────────────────

export function ZoneStationMap({
  zone,
  stations,
  onZoneChange,
  onStationDraw,
  onStationClick,
  drawMode,
  drawingTarget,
  editMode,
}: ZoneStationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<typeof import('leaflet') | null>(null);

  // Refs for layers to manage cleanup
  const zoneLayerRef = useRef<import('leaflet').Layer | null>(null);
  const stationLayersRef = useRef<import('leaflet').Layer[]>([]);
  const drawingPointsRef = useRef<PolygonPoint[]>([]);
  const drawingMarkersRef = useRef<import('leaflet').CircleMarker[]>([]);
  const drawingLineRef = useRef<import('leaflet').Polyline | null>(null);
  const editMarkersRef = useRef<import('leaflet').Marker[]>([]);
  const circlePreviewRef = useRef<import('leaflet').Circle | null>(null);

  // ── Initialize map ─────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    void import('leaflet').then((leaflet) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = leaflet.map(mapRef.current, {
        doubleClickZoom: false,
      }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setL(leaflet);
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── Render zone overlay ────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;

    // Remove old zone layer
    if (zoneLayerRef.current) {
      zoneLayerRef.current.remove();
      zoneLayerRef.current = null;
    }

    if (!zone) return;

    if (zone.type === 'CIRCLE' && zone.latitude != null && zone.longitude != null) {
      const circle = L.circle(
        [Number(zone.latitude), Number(zone.longitude)],
        {
          radius: zone.radiusMeters ?? 1000,
          fillColor: zone.color,
          color: zone.color,
          weight: 2,
          fillOpacity: 0.12,
          dashArray: '8 4',
        },
      );
      circle.addTo(map);
      zoneLayerRef.current = circle;
    } else if (
      zone.type === 'POLYGON' &&
      zone.polygonPoints &&
      zone.polygonPoints.length >= 3
    ) {
      const polygon = L.polygon(
        zone.polygonPoints.map((p) => [p.lat, p.lng]),
        {
          fillColor: zone.color,
          color: zone.color,
          weight: 2,
          fillOpacity: 0.12,
          dashArray: '8 4',
        },
      );
      polygon.addTo(map);
      zoneLayerRef.current = polygon;
    }
  }, [zone, mapReady, L]);

  // ── Render station overlays ────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;

    // Remove old station layers
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
          fillColor: STATION_FILL_COLOR,
          color: STATION_STROKE_COLOR,
          weight: 2,
          fillOpacity: 0.25,
        });
        circle.addTo(map);
        stationLayersRef.current.push(circle);

        const center = L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: '#ff0000',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1,
        });
        center.bindPopup(`<strong>📍 ${station.name}</strong>`);
        if (onStationClick) {
          center.on('click', () => onStationClick(station.id));
        }
        center.addTo(map);
        stationLayersRef.current.push(center);
      } else if (
        station.type === 'POLYGON' &&
        station.polygonPoints &&
        station.polygonPoints.length >= 3
      ) {
        const polygon = L.polygon(
          station.polygonPoints.map((p) => [p.lat, p.lng]),
          {
            fillColor: STATION_FILL_COLOR,
            color: STATION_STROKE_COLOR,
            weight: 2,
            fillOpacity: 0.25,
          },
        );
        polygon.bindPopup(`<strong>📍 ${station.name}</strong>`);
        if (onStationClick) {
          polygon.on('click', () => onStationClick(station.id));
        }
        polygon.addTo(map);
        stationLayersRef.current.push(polygon);
      }
    });

    // Fit bounds to all content
    const allCoords: [number, number][] = [];

    if (zone?.type === 'CIRCLE' && zone.latitude != null && zone.longitude != null) {
      allCoords.push([Number(zone.latitude), Number(zone.longitude)]);
    } else if (zone?.type === 'POLYGON' && zone.polygonPoints) {
      zone.polygonPoints.forEach((p) => allCoords.push([p.lat, p.lng]));
    }

    stations.forEach((s) => {
      if (s.latitude != null && s.longitude != null) {
        allCoords.push([Number(s.latitude), Number(s.longitude)]);
      }
      if (s.polygonPoints) {
        s.polygonPoints.forEach((p) => allCoords.push([p.lat, p.lng]));
      }
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stations, zone, mapReady, L, onStationClick]);

  // ── Drawing logic ──────────────────────────────────────────

  const clearDrawingState = useCallback(() => {
    drawingPointsRef.current = [];
    drawingMarkersRef.current.forEach((m) => m.remove());
    drawingMarkersRef.current = [];
    if (drawingLineRef.current) {
      drawingLineRef.current.remove();
      drawingLineRef.current = null;
    }
    if (circlePreviewRef.current) {
      circlePreviewRef.current.remove();
      circlePreviewRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;

    // Clear previous drawing state when mode changes
    clearDrawingState();

    if (drawMode === 'none') {
      map.getContainer().style.cursor = '';
      return;
    }

    map.getContainer().style.cursor = 'crosshair';

    const color = drawingTarget === 'zone' ? (zone?.color ?? '#3b82f6') : STATION_FILL_COLOR;

    function onMapClick(e: import('leaflet').LeafletMouseEvent) {
      if (!L) return;

      if (drawMode === 'polygon') {
        const point: PolygonPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        drawingPointsRef.current.push(point);

        // Add marker for the point
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 6,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1,
        });
        marker.addTo(map);
        drawingMarkersRef.current.push(marker);

        // Update preview line
        if (drawingLineRef.current) {
          drawingLineRef.current.remove();
        }
        if (drawingPointsRef.current.length >= 2) {
          const latLngs = drawingPointsRef.current.map((p) => L.latLng(p.lat, p.lng));
          // Close the polygon preview
          latLngs.push(latLngs[0]!);
          drawingLineRef.current = L.polyline(latLngs, {
            color,
            weight: 2,
            dashArray: '6 3',
          });
          drawingLineRef.current.addTo(map);
        }
      } else if (drawMode === 'circle') {
        if (drawingPointsRef.current.length === 0) {
          // First click = center
          const center: PolygonPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
          drawingPointsRef.current.push(center);

          const marker = L.circleMarker([center.lat, center.lng], {
            radius: 6,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 1,
          });
          marker.addTo(map);
          drawingMarkersRef.current.push(marker);
        } else {
          // Second click = edge (compute radius)
          const centerPt = drawingPointsRef.current[0]!;
          const centerLatLng = L.latLng(centerPt.lat, centerPt.lng);
          const edgeLatLng = L.latLng(e.latlng.lat, e.latlng.lng);
          const radius = Math.round(centerLatLng.distanceTo(edgeLatLng));

          clearDrawingState();

          if (drawingTarget === 'zone') {
            onZoneChange({
              type: 'CIRCLE',
              latitude: centerPt.lat,
              longitude: centerPt.lng,
              radiusMeters: radius,
              color: zone?.color ?? '#3b82f6',
            });
          } else {
            onStationDraw({
              type: 'CIRCLE',
              latitude: centerPt.lat,
              longitude: centerPt.lng,
              radiusMeters: radius,
            });
          }
        }
      }
    }

    function onMouseMove(e: import('leaflet').LeafletMouseEvent) {
      if (!L || drawMode !== 'circle' || drawingPointsRef.current.length !== 1) return;

      const centerPt = drawingPointsRef.current[0]!;
      const centerLatLng = L.latLng(centerPt.lat, centerPt.lng);
      const radius = centerLatLng.distanceTo(e.latlng);

      if (circlePreviewRef.current) {
        circlePreviewRef.current.setRadius(radius);
      } else {
        circlePreviewRef.current = L.circle([centerPt.lat, centerPt.lng], {
          radius,
          fillColor: color,
          color,
          weight: 2,
          fillOpacity: 0.15,
          dashArray: '6 3',
        });
        circlePreviewRef.current.addTo(map);
      }
    }

    map.on('click', onMapClick);
    map.on('mousemove', onMouseMove);

    return () => {
      map.off('click', onMapClick);
      map.off('mousemove', onMouseMove);
      map.getContainer().style.cursor = '';
    };
  }, [drawMode, drawingTarget, mapReady, L, zone, onZoneChange, onStationDraw, clearDrawingState]);

  // ── Finalize polygon drawing (called externally) ───────────

  const finalizePolygon = useCallback(() => {
    if (drawingPointsRef.current.length < 3) return;
    const points = [...drawingPointsRef.current];
    clearDrawingState();

    if (drawingTarget === 'zone') {
      onZoneChange({
        type: 'POLYGON',
        polygonPoints: points,
        color: zone?.color ?? '#3b82f6',
      });
    } else {
      onStationDraw({
        type: 'POLYGON',
        polygonPoints: points,
      });
    }
  }, [drawingTarget, clearDrawingState, onZoneChange, onStationDraw, zone?.color]);

  // ── Edit mode: make zone polygon points draggable ──────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;

    // Clean up previous edit markers
    editMarkersRef.current.forEach((m) => m.remove());
    editMarkersRef.current = [];

    if (!editMode || !zone) return;

    if (zone.type === 'POLYGON' && zone.polygonPoints && zone.polygonPoints.length >= 3) {
      const color = zone.color;

      zone.polygonPoints.forEach((point, index) => {
        const icon = L.divIcon({
          className: 'zone-edit-marker',
          html: `<div style="
            width: 14px; height: 14px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([point.lat, point.lng], {
          draggable: true,
          icon,
        });

        marker.on('dragend', () => {
          const newPos = marker.getLatLng();
          const updatedPoints = [...(zone.polygonPoints ?? [])];
          updatedPoints[index] = { lat: newPos.lat, lng: newPos.lng };
          onZoneChange({
            ...zone,
            polygonPoints: updatedPoints,
          });
        });

        marker.addTo(map);
        editMarkersRef.current.push(marker);
      });
    } else if (zone.type === 'CIRCLE' && zone.latitude != null && zone.longitude != null) {
      // For circle: drag center and edge
      const centerIcon = L.divIcon({
        className: 'zone-edit-marker',
        html: `<div style="
          width: 14px; height: 14px;
          background: ${zone.color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const centerMarker = L.marker(
        [Number(zone.latitude), Number(zone.longitude)],
        { draggable: true, icon: centerIcon },
      );

      centerMarker.on('dragend', () => {
        const newPos = centerMarker.getLatLng();
        onZoneChange({
          ...zone,
          latitude: newPos.lat,
          longitude: newPos.lng,
        });
      });

      centerMarker.addTo(map);
      editMarkersRef.current.push(centerMarker);
    }

    return () => {
      editMarkersRef.current.forEach((m) => m.remove());
      editMarkersRef.current = [];
    };
  }, [editMode, zone, mapReady, L, onZoneChange]);

  // Expose finalizePolygon via data attribute for parent
  useEffect(() => {
    if (mapRef.current) {
      (mapRef.current as HTMLDivElement & { _finalizePolygon?: () => void })._finalizePolygon = finalizePolygon;
    }
  }, [finalizePolygon]);

  return (
    <div
      ref={mapRef}
      id="zone-station-map"
      style={{
        height: '100%',
        width: '100%',
        minHeight: '500px',
        borderRadius: '8px',
      }}
    />
  );
}

export type { DrawMode, ZoneGeometry, StationOverlay, ZoneStationMapProps };
