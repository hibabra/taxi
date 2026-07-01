import { hasPermission, Permission, UserRole } from '@taxikiwi/shared-config';

export { Permission, UserRole };

export function hasRole(roles: readonly string[] | undefined, role: UserRole): boolean {
  return roles?.includes(role) ?? false;
}

export function can(roles: readonly string[] | undefined, permission: Permission): boolean {
  return (
    roles?.some((role) => {
      if (!isUserRole(role)) {
        return false;
      }

      return hasPermission(role, permission);
    }) ?? false
  );
}

function isUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}
