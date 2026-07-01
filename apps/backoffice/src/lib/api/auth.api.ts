import type {
  AuthTokenResponse,
  AuthUserResponse,
  ChangePasswordPayload,
  GroupementLoginPayload,
  LoginPayload,
} from '@taxikiwi/shared-types';

import { api, type ApiClient } from './client';

export function platformLogin(dto: LoginPayload) {
  return api.post('auth/platform/login', { json: dto }).json<AuthTokenResponse>();
}

export function login(dto: LoginPayload) {
  return api.post('auth/login', { json: dto }).json<AuthTokenResponse>();
}

export function groupementLogin(dto: GroupementLoginPayload) {
  return api.post('auth/groupement/login', { json: dto }).json<AuthTokenResponse>();
}

export function refreshAuthSession(client: ApiClient) {
  return client.post('auth/refresh').json<AuthTokenResponse>();
}

export function logout(client: ApiClient) {
  return client.post('auth/logout').text();
}

export function getMe(client: ApiClient) {
  return client.get('auth/me').json<AuthUserResponse>();
}

export function changePassword(client: ApiClient, dto: ChangePasswordPayload) {
  return client.post('auth/change-password', { json: dto }).text();
}
