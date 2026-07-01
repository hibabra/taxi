import type { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import type { AuthTokenResponse, UserRole } from '@taxikiwi/shared-types';

type TaxiKiwiAuthUser = User & {
  accessToken: string;
  accessTokenExpiresAt: number;
  driverId?: string | null;
  driverIdentifier?: string | null;
    groupementId: string | null;
    groupementName?: string | null;
    isGroupAdmin?: boolean;
    loginAt: number;
  refreshToken: string;
  rememberMe: boolean;
  roles: UserRole[];
};

const apiBaseUrl = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL)?.replace(
  /\/+$/,
  '',
);

export const authOptions: NextAuthOptions = {
  callbacks: {
    async jwt({ token, user }) {
      const authUser = user as TaxiKiwiAuthUser | undefined;

      if (authUser) {
        token.accessToken = authUser.accessToken;
        token.accessTokenExpiresAt = authUser.accessTokenExpiresAt;
        token.driverId = authUser.driverId;
        token.driverIdentifier = authUser.driverIdentifier;
        token.driverIdentifier = authUser.driverIdentifier;
        token.groupementId = authUser.groupementId;
        token.groupementName = authUser.groupementName;
        token.isGroupAdmin = authUser.isGroupAdmin;
        token.loginAt = authUser.loginAt;
        token.refreshToken = authUser.refreshToken;
        token.rememberMe = authUser.rememberMe;
        token.roles = authUser.roles;
        delete token.error;
      }

      // "Se souvenir de moi" non coché → session expire après 24h
      const SESSION_SHORT = 24 * 60 * 60 * 1000; // 24h
      if (
        token.rememberMe === false &&
        token.loginAt &&
        Date.now() - (token.loginAt as number) > SESSION_SHORT
      ) {
        return { ...token, error: 'RefreshAccessTokenError' as const };
      }

      if (
        token.accessToken &&
        token.accessTokenExpiresAt &&
        Date.now() < token.accessTokenExpiresAt - 30_000
      ) {
        return token;
      }

      return refreshAccessToken(token);
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as 'RefreshAccessTokenError' | undefined;
      session.user.driverId = token.driverId as string | null | undefined;
      session.user.driverIdentifier = token.driverIdentifier as string | null | undefined;
      session.user.groupementId = token.groupementId as string | null | undefined;
      session.user.groupementName = token.groupementName as string | null | undefined;
      session.user.isGroupAdmin = token.isGroupAdmin as boolean | undefined;
      session.user.roles = (token.roles as UserRole[] | undefined) ?? [];

      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
        rememberMe: { label: 'Se souvenir de moi', type: 'text' },
      },
      id: 'platform',
      name: 'Plateforme',
      async authorize(credentials) {
        if (!apiBaseUrl || !credentials?.email || !credentials.password) {
          return null;
        }

        return authenticate('auth/platform/login', {
          email: credentials.email,
          password: credentials.password,
        }, credentials.rememberMe === 'true');
      },
    }),
    CredentialsProvider({
      credentials: {
        groupementCode: { label: 'Code groupement', type: 'text' },
        identifier: { label: 'Identifiant', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
        rememberMe: { label: 'Se souvenir de moi', type: 'text' },
      },
      id: 'groupement',
      name: 'Groupement',
      async authorize(credentials) {
        if (
          !apiBaseUrl ||
          !credentials?.groupementCode ||
          !credentials.identifier ||
          !credentials.password
        ) {
          return null;
        }

        return authenticate('auth/groupement/login', {
          groupementCode: credentials.groupementCode,
          identifier: credentials.identifier,
          password: credentials.password,
        }, credentials.rememberMe === 'true');
      },
    }),
  ],
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 jours (si "Se souvenir de moi" coché)
    strategy: 'jwt',
  },
};

async function authenticate(
  path: string,
  body: Record<string, string>,
  rememberMe: boolean,
): Promise<TaxiKiwiAuthUser | null> {
  const response = await fetch(`${apiBaseUrl}/${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as AuthTokenResponse;
  const refreshToken = extractRefreshToken(response.headers.get('set-cookie'));

  if (!refreshToken) {
    return null;
  }

  return {
    accessToken: payload.accessToken,
    accessTokenExpiresAt: Date.now() + payload.expiresIn * 1000,
    driverId: payload.user.driverId,
    driverIdentifier: payload.user.driverIdentifier,
    email: payload.user.email,
    groupementId: payload.user.groupementId,
    groupementName: payload.user.groupementName,
    id: payload.user.id,
    isGroupAdmin: payload.user.isGroupAdmin,
    loginAt: Date.now(),
    name: payload.user.email,
    refreshToken,
    rememberMe,
    roles: payload.user.roles,
  };
}

async function refreshAccessToken(token: import('next-auth/jwt').JWT) {
  if (!apiBaseUrl || !token.refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' as const };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      headers: {
        cookie: `taxikiwi_refresh_token=${token.refreshToken}`,
      },
      method: 'POST',
    });

    if (!response.ok) {
      return { ...token, error: 'RefreshAccessTokenError' as const };
    }

    const payload = (await response.json()) as AuthTokenResponse;
    const nextRefreshToken = extractRefreshToken(response.headers.get('set-cookie'));

    return {
      ...token,
      accessToken: payload.accessToken,
      accessTokenExpiresAt: Date.now() + payload.expiresIn * 1000,
      driverId: payload.user.driverId,
      driverIdentifier: payload.user.driverIdentifier,
      error: undefined,
      groupementId: payload.user.groupementId,
      groupementName: payload.user.groupementName,
      isGroupAdmin: payload.user.isGroupAdmin,
      refreshToken: nextRefreshToken ?? token.refreshToken,
      roles: payload.user.roles,
    };
  } catch {
    // Réseau indisponible ou API non joignable → session expirée
    return { ...token, error: 'RefreshAccessTokenError' as const };
  }
}

function extractRefreshToken(setCookieHeader: null | string): null | string {
  if (!setCookieHeader) {
    return null;
  }

  const match = /(?:^|,\s*)taxikiwi_refresh_token=([^;]+)/.exec(setCookieHeader);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
