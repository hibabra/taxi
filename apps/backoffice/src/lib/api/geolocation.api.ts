import type {
  DriverAvailabilityStatus,
  DriverPosition,
  UpdatePositionPayload,
} from '@taxikiwi/shared-types';
import type { ApiClient } from './client';

export type { DriverAvailabilityStatus, DriverPosition, UpdatePositionPayload };

export function getAllPositions(client: ApiClient) {
  return client.get('geolocation/positions').json<DriverPosition[]>();
}

export function getDriverPosition(client: ApiClient, driverId: string) {
  return client
    .get(`geolocation/positions/${driverId}`)
    .json<DriverPosition | null>();
}
export function updatePosition(
  client: ApiClient,
  payload: UpdatePositionPayload,
) {
  return client.post('geolocation/position', { json: payload }).json<DriverPosition>();
}