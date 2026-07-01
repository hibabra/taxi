import type {
  AcceptDriverInvitationPayload,
  CreateDriverPayload,
  CreateDriverInvitationPayload,
  Driver,
  DriverInvitation,
  DriverStatus,
  PaginatedResponse,
  UpdateDriverPayload,
} from '@taxikiwi/shared-types';

import { api, compactSearchParams, type ApiClient } from './client';

export function listDrivers(
  client: ApiClient,
  params?: {
    limit?: number;
    matricule?: string;
    page?: number;
    search?: string;
    status?: DriverStatus;
  },
) {
  return client
    .get('drivers', { searchParams: compactSearchParams(params) })
    .json<PaginatedResponse<Driver>>();
}

export function getDriver(client: ApiClient, driverId: string) {
  return client.get(`drivers/${driverId}`).json<Driver>();
}

export function createDriverInvitation(client: ApiClient, dto: CreateDriverInvitationPayload) {
  return client.post('drivers/invitations', { json: dto }).json<DriverInvitation>();
}

export function createDriver(client: ApiClient, dto: CreateDriverPayload) {
  return client.post('drivers', { json: dto }).json<Driver>();
}

export function updateDriver(client: ApiClient, driverId: string, dto: UpdateDriverPayload) {
  return client.patch(`drivers/${driverId}`, { json: dto }).json<Driver>();
}

export function acceptDriverInvitation(token: string, dto: AcceptDriverInvitationPayload) {
  return api.post(`drivers/invitations/${token}/accept`, { json: dto }).json<Driver>();
}

export function suspendDriver(client: ApiClient, driverId: string, reason: string) {
  return client.post(`drivers/${driverId}/suspend`, { json: { reason } }).json<Driver>();
}

export function reactivateDriver(client: ApiClient, driverId: string) {
  return client.post(`drivers/${driverId}/reactivate`).json<Driver>();
}

export function offboardDriver(client: ApiClient, driverId: string) {
  return client.delete(`drivers/${driverId}`).json<Driver>();
}
