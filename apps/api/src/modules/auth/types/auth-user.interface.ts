import { UserRole } from './role.enum';

export interface AuthUserRecord {
  id: string;
  email: string;
  groupementId: string | null;
  groupementName: string | null;
  groupementIsActive: boolean;
  isActive: boolean;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
  roles: UserRole[];
  driverId?: string | null;
  driverIdentifier?: string | null;
  isGroupAdmin?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  groupementId: string | null;
  groupementName: string | null;
  roles: UserRole[];
  sessionId: string;
  familyId: string;
  driverId?: string | null;
  driverIdentifier?: string | null;
  isGroupAdmin?: boolean;
}

export interface RefreshTokenRequestUser {
  userId: string;
  tokenId: string;
  familyId: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  groupementId: string | null;
  groupementName: string | null;
  roles: UserRole[];
  sessionId: string;
  familyId: string;
  driverId?: string | null;
  driverIdentifier?: string | null;
  isGroupAdmin?: boolean;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  familyId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}
