// @taxikiwi/shared-config — constantes métier partagées API ↔ Backoffice

export { AuditAction } from './audit-actions';
export { ERROR_CODES_BY_STATUS } from './errors';
export {
  AUTH_ACCOUNT_DISABLED,
  AUTH_INVALID_CREDENTIALS,
  AUTH_INVALID_REFRESH_TOKEN,
  AUTH_TOKEN_EXPIRED,
  AUTH_TOKEN_REUSE_DETECTED,
  CONFLICT,
  FORBIDDEN,
  HTTP_ERROR,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  RESOURCE_ALREADY_EXISTS,
  TENANT_MISMATCH,
  TENANT_MISSING,
  UNAUTHORIZED,
  VALIDATION_ERROR,
} from './errors';
export { hasPermission, Permission, ROLE_PERMISSIONS } from './permissions';
export { ALL_ROLES, ROLE_HIERARCHY, UserRole } from './roles';
