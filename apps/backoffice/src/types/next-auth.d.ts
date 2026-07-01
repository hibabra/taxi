import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@taxikiwi/shared-types';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError';
    user: DefaultSession['user'] & {
      driverId?: string | null;
      driverIdentifier?: string | null;
      groupementId?: string | null;
      groupementName?: string | null;
      isGroupAdmin?: boolean;
      roles: UserRole[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    driverId?: string | null;
    driverIdentifier?: string | null;
    error?: 'RefreshAccessTokenError';
    groupementId?: string | null;
    groupementName?: string | null;
    isGroupAdmin?: boolean;
    loginAt?: number;
    refreshToken?: string;
    rememberMe?: boolean;
    roles?: UserRole[];
  }
}
