import type { PolygonPoint, StationType, UpdateGroupementPayload } from '@taxikiwi/shared-types';
import type { ApiClient } from './client';

export interface ZoneData {
  zoneType: StationType | null;
  zoneLatitude: number | null;
  zoneLongitude: number | null;
  zoneRadiusMeters: number | null;
  zonePolygonPoints: PolygonPoint[] | null;
  zoneColor: string;
}

export function getZone(client: ApiClient): Promise<ZoneData> {
  return client.get('stations/zone').json<ZoneData>();
}

export function updateZone(
  client: ApiClient,
  payload: Partial<{
    zoneType: StationType | null;
    zoneLatitude: number | null;
    zoneLongitude: number | null;
    zoneRadiusMeters: number | null;
    zonePolygonPoints: PolygonPoint[] | null;
    zoneColor: string;
  }>,
): Promise<ZoneData> {
  return client.patch('stations/zone', { json: payload }).json<ZoneData>();
}
