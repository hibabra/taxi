import type { UserRole } from './domain';

/**
 * Types partagés pour le module Auth.
 */
export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserResponse;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  groupementId: string | null;
  groupementName?: string | null;
  roles: UserRole[];
  driverId?: string | null;
  driverIdentifier?: string | null;
  isGroupAdmin?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GroupementLoginPayload {
  groupementCode: string;
  identifier: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
