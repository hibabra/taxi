import type {
  Client,
  ClientAddressPayload,
  CreateClientPayload,
  PaginatedResponse,
  UpdateClientPayload,
} from '@taxikiwi/shared-types';

import { compactSearchParams, type ApiClient } from './client';

export function listClients(
  client: ApiClient,
  params?: {
    includeArchived?: boolean;
    isBlacklisted?: boolean;
    limit?: number;
    page?: number;
    phone?: string;
    search?: string;
  },
) {
  return client
    .get('clients', { searchParams: compactSearchParams(params) })
    .json<PaginatedResponse<Client>>();
}

export function getClient(client: ApiClient, clientId: string) {
  return client.get(`clients/${clientId}`).json<Client>();
}

export function searchClientByPhone(
  client: ApiClient,
  params: { countryCode?: string; phone: string },
) {
  return client.get('clients/search', { searchParams: compactSearchParams(params) }).json<Client>();
}

export function createClient(client: ApiClient, dto: CreateClientPayload) {
  return client.post('clients', { json: dto }).json<Client>();
}

export function updateClient(client: ApiClient, clientId: string, dto: UpdateClientPayload) {
  return client.patch(`clients/${clientId}`, { json: dto }).json<Client>();
}

export function archiveClient(client: ApiClient, clientId: string) {
  return client.delete(`clients/${clientId}`).json<Client>();
}

export function unarchiveClient(client: ApiClient, clientId: string) {
  return client.post(`clients/${clientId}/unarchive`).json<Client>();
}

export function blacklistClient(client: ApiClient, clientId: string, reason: string) {
  return client.post(`clients/${clientId}/blacklist`, { json: { reason } }).json<Client>();
}

export function unblacklistClient(client: ApiClient, clientId: string) {
  return client.post(`clients/${clientId}/unblacklist`).json<Client>();
}

export function addClientAddress(client: ApiClient, clientId: string, dto: ClientAddressPayload) {
  return client.post(`clients/${clientId}/addresses`, { json: dto }).json<Client>();
}

export function updateClientAddress(
  client: ApiClient,
  clientId: string,
  addressId: string,
  dto: Partial<ClientAddressPayload>,
) {
  return client.patch(`clients/${clientId}/addresses/${addressId}`, { json: dto }).json<Client>();
}

export function deleteClientAddress(client: ApiClient, clientId: string, addressId: string) {
  return client.delete(`clients/${clientId}/addresses/${addressId}`).json<Client>();
}
