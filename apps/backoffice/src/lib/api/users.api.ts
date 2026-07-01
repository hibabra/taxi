import type {
  AcceptUserInvitationPayload,
  CreateUserInvitationPayload,
  PaginatedResponse,
  ResetPasswordPayload,
  UpdateUserPayload,
  User,
  UserInvitation,
  UserRole,
} from '@taxikiwi/shared-types';

import { api, compactSearchParams, type ApiClient } from './client';

export function listUsers(
  client: ApiClient,
  params?: {
    isActive?: boolean;
    limit?: number;
    page?: number;
    role?: UserRole;
    search?: string;
  },
) {
  return client
    .get('users', { searchParams: compactSearchParams(params) })
    .json<PaginatedResponse<User>>();
}

export function getUser(client: ApiClient, userId: string) {
  return client.get(`users/${userId}`).json<User>();
}

export function createUserInvitation(client: ApiClient, dto: CreateUserInvitationPayload) {
  return client.post('users/invitations', { json: dto }).json<UserInvitation>();
}

export function acceptUserInvitation(token: string, dto: AcceptUserInvitationPayload) {
  return api.post(`users/invitations/${token}/accept`, { json: dto }).json<User>();
}

export function updateUser(client: ApiClient, userId: string, dto: UpdateUserPayload) {
  return client.patch(`users/${userId}`, { json: dto }).json<User>();
}

export function deactivateUser(client: ApiClient, userId: string) {
  return client.delete(`users/${userId}`).json<User>();
}

export function requestUserPasswordReset(client: ApiClient, userId: string) {
  return client.post(`users/${userId}/reset-password`).json<UserInvitation>();
}

export function acceptUserPasswordReset(token: string, dto: ResetPasswordPayload) {
  return api.post(`users/reset-password/${token}/accept`, { json: dto }).text();
}
