import type {
  Station,
  StationType,
  PolygonPoint,
  CreateStationPayload,
  UpdateStationPayload,
} from '@taxikiwi/shared-types';
import type { ApiClient } from './client';

export type { Station, StationType, PolygonPoint, CreateStationPayload, UpdateStationPayload };

export function listStations(client: ApiClient) {
  return client.get('stations').json<Station[]>();
}

export function getStation(client: ApiClient, stationId: string) {
  return client.get(`stations/${stationId}`).json<Station>();
}

export function createStation(client: ApiClient, dto: CreateStationPayload) {
  return client.post('stations', { json: dto }).json<Station>();
}

export function updateStation(client: ApiClient, stationId: string, dto: UpdateStationPayload) {
  return client.patch(`stations/${stationId}`, { json: dto }).json<Station>();
}

export function deleteStation(client: ApiClient, stationId: string) {
  return client.delete(`stations/${stationId}`).json<Station>();
}