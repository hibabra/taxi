import type {
  CreateGroupementPayload,
  Groupement,
  PaginatedResponse,
  UpdateGroupementPayload,
  UpdateGroupementSettingsPayload,
} from '@taxikiwi/shared-types';

import { compactSearchParams, type ApiClient } from './client';

export function listGroupements(
  client: ApiClient,
  params?: { isActive?: boolean; limit?: number; page?: number; search?: string },
) {
  return client
    .get('groupements', {
      searchParams: compactSearchParams(params),
    })
    .json<PaginatedResponse<Groupement>>();
}

export function getGroupement(client: ApiClient, groupementId: string) {
  return client.get(`groupements/${groupementId}`).json<Groupement>();
}

export function createGroupement(client: ApiClient, dto: CreateGroupementPayload) {
  return client.post('groupements', { json: dto }).json<{
    adminInvitation: unknown;
    groupement: Groupement;
  }>();
}

export function updateGroupement(
  client: ApiClient,
  groupementId: string,
  dto: UpdateGroupementPayload,
) {
  return client.patch(`groupements/${groupementId}`, { json: dto }).json<Groupement>();
}

export function updateGroupementSettings(
  client: ApiClient,
  groupementId: string,
  dto: UpdateGroupementSettingsPayload,
) {
  return client.patch(`groupements/${groupementId}/settings`, { json: dto }).json<Groupement>();
}

export function deactivateGroupement(client: ApiClient, groupementId: string) {
  return client.patch(`groupements/${groupementId}/deactivate`).json<Groupement>();
}

export function deleteGroupement(client: ApiClient, groupementId: string) {
  return client.delete(`groupements/${groupementId}`).json<Groupement>();
}
