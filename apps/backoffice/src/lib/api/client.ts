import ky, { HTTPError, type KyInstance } from 'ky';

import { ApiError, type BackendErrorPayload } from './errors';

type ApiClientOptions = {
  accessToken?: string | null;
  groupementId?: string | null;
};

export type ApiClient = KyInstance;

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const prefix = getApiPrefix();

  return ky.create({
    credentials: 'include',
    hooks: {
      afterResponse: [
        async ({ options: requestOptions, request, response }) => {
          if (response.ok) {
            return response;
          }

          const payload = await response
            .clone()
            .json()
            .then((body) => (isBackendErrorPayload(body) ? body : null))
            .catch(() => null);

          if (payload) {
            throw new ApiError(payload);
          }

          throw new HTTPError(response, request, requestOptions);
        },
      ],
      beforeRequest: [
        ({ request }) => {
          if (options.accessToken) {
            request.headers.set('Authorization', `Bearer ${options.accessToken}`);
          }

          if (options.groupementId) {
            request.headers.set('x-groupement-id', options.groupementId);
          }
        },
      ],
    },
    prefix,
  });
}

export const api = createApiClient();

function getApiPrefix(): string {
  const prefix =
    typeof window === 'undefined'
      ? (process.env.API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        'http://localhost:3000/api/v1')
      : (process.env.NEXT_PUBLIC_API_PROXY_URL ?? '/api/backend');

  return prefix.replace(/\/+$/, '');
}

function isBackendErrorPayload(value: unknown): value is BackendErrorPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return typeof payload.message === 'string' && typeof payload.statusCode === 'number';
}

export function compactSearchParams(
  params?: Record<string, boolean | number | string | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter((entry): entry is [string, boolean | number | string] => {
      return entry[1] !== undefined && entry[1] !== null && entry[1] !== '';
    }),
  );
}
