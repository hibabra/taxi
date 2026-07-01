/**
 * Rôles utilisateur du système TaxiKiwi.
 *
 * Source de vérité unique — importé par l'API et le backoffice.
 * Ne jamais dupliquer cette enum dans d'autres packages.
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}

/** Liste de tous les rôles disponibles. */
export const ALL_ROLES = Object.values(UserRole);

/**
 * Hiérarchie des rôles — chaque rôle inclut implicitement
 * les permissions des rôles listés dans son tableau.
 *
 * ADMIN > DRIVER.
 *
 * SUPER_ADMIN est volontairement separe des roles de groupement :
 * il supervise la plateforme mais n'herite pas des droits operationnels
 * d'un admin de groupement.
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.SUPER_ADMIN]: [],
  [UserRole.ADMIN]: [UserRole.DRIVER],
  [UserRole.DRIVER]: [],
};
