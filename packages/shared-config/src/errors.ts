/**
 * Codes d'erreur stables de l'API TaxiKiwi.
 *
 * Utilisés par le filtre `AllExceptionsFilter` et consommés
 * par le backoffice pour afficher des messages localisés.
 * Format inspiré de la RFC 7807 (Problem Details for HTTP APIs).
 */

// ── Erreurs génériques ──────────────────────────────────────
export const VALIDATION_ERROR = 'VALIDATION_ERROR' as const;
export const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR' as const;
export const HTTP_ERROR = 'HTTP_ERROR' as const;

// ── Authentification ────────────────────────────────────────
export const UNAUTHORIZED = 'UNAUTHORIZED' as const;
export const FORBIDDEN = 'FORBIDDEN' as const;
export const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS' as const;
export const AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED' as const;
export const AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED' as const;
export const AUTH_TOKEN_REUSE_DETECTED = 'AUTH_TOKEN_REUSE_DETECTED' as const;
export const AUTH_INVALID_REFRESH_TOKEN = 'AUTH_INVALID_REFRESH_TOKEN' as const;

// ── Ressources ──────────────────────────────────────────────
export const NOT_FOUND = 'NOT_FOUND' as const;
export const CONFLICT = 'CONFLICT' as const;
export const RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS' as const;

// ── Multi-tenant ────────────────────────────────────────────
export const TENANT_MISSING = 'TENANT_MISSING' as const;
export const TENANT_MISMATCH = 'TENANT_MISMATCH' as const;

/**
 * Mapping HTTP status → code d'erreur par défaut.
 * Utilisé par `AllExceptionsFilter` quand l'exception
 * ne fournit pas de code custom.
 */
export const ERROR_CODES_BY_STATUS: Record<number, string> = {
  400: VALIDATION_ERROR,
  401: UNAUTHORIZED,
  403: FORBIDDEN,
  404: NOT_FOUND,
  409: CONFLICT,
  500: INTERNAL_SERVER_ERROR,
};
