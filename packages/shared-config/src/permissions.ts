import { UserRole } from './roles';

/**
 * Actions disponibles dans le système TaxiKiwi.
 *
 * Chaque action correspond à une opération CRUD
 * sur une ressource métier.
 */
export enum Permission {
  // Groupements
  GROUPEMENT_READ = 'GROUPEMENT_READ',
  GROUPEMENT_CREATE = 'GROUPEMENT_CREATE',
  GROUPEMENT_UPDATE = 'GROUPEMENT_UPDATE',
  GROUPEMENT_DELETE = 'GROUPEMENT_DELETE',

  // Users
  USER_READ = 'USER_READ',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_INVITE = 'USER_INVITE',

  // Drivers
  DRIVER_READ = 'DRIVER_READ',
  DRIVER_CREATE = 'DRIVER_CREATE',
  DRIVER_UPDATE = 'DRIVER_UPDATE',
  DRIVER_DELETE = 'DRIVER_DELETE',

  // Clients
  CLIENT_READ = 'CLIENT_READ',
  CLIENT_CREATE = 'CLIENT_CREATE',
  CLIENT_UPDATE = 'CLIENT_UPDATE',
  CLIENT_DELETE = 'CLIENT_DELETE',

  // Courses
  COURSE_READ = 'COURSE_READ',
  COURSE_CREATE = 'COURSE_CREATE',
  COURSE_UPDATE = 'COURSE_UPDATE',
  COURSE_DELETE = 'COURSE_DELETE',

  // ── Stations (Vague 2) ───────────────────────────────────
  STATION_READ = 'STATION_READ',
  STATION_CREATE = 'STATION_CREATE',
  STATION_UPDATE = 'STATION_UPDATE',
  STATION_DELETE = 'STATION_DELETE',

  // ── Geolocation (Vague 2) ────────────────────────────────
  GEOLOCATION_READ = 'GEOLOCATION_READ',
  GEOLOCATION_UPDATE = 'GEOLOCATION_UPDATE',

  // ── Queue / Tour de rôle (Vague 2) ───────────────────────
  QUEUE_READ = 'QUEUE_READ',
  QUEUE_UPDATE = 'QUEUE_UPDATE',

  // Audit
  AUDIT_READ = 'AUDIT_READ',
}

/**
 * Matrice rôle × permissions.
 *
 * SUPER_ADMIN supervise la plateforme et les groupements.
 * ADMIN gère les opérations de son groupement.
 * DRIVER est réservé à l'application mobile chauffeur.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.GROUPEMENT_READ,
    Permission.GROUPEMENT_CREATE,
    Permission.GROUPEMENT_UPDATE,
    Permission.GROUPEMENT_DELETE,
    Permission.DRIVER_READ,
    Permission.STATION_READ,
    Permission.GEOLOCATION_READ, // ✅ voir la carte
    Permission.QUEUE_READ, // ✅ voir le tour de rôle
    Permission.AUDIT_READ,
  ],

  [UserRole.ADMIN]: [
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_INVITE,

    Permission.DRIVER_READ,
    Permission.DRIVER_CREATE,
    Permission.DRIVER_UPDATE,
    Permission.DRIVER_DELETE,

    Permission.CLIENT_READ,
    Permission.CLIENT_CREATE,
    Permission.CLIENT_UPDATE,
    Permission.CLIENT_DELETE,

    Permission.COURSE_READ,
    Permission.COURSE_CREATE,
    Permission.COURSE_UPDATE,
    Permission.COURSE_DELETE,

    // Stations
    Permission.STATION_READ,
    Permission.STATION_CREATE,
    Permission.STATION_UPDATE,
    Permission.STATION_DELETE,

    // Geolocation
    Permission.GEOLOCATION_READ,
    Permission.GEOLOCATION_UPDATE,

    // Queue
    Permission.QUEUE_READ,
    Permission.QUEUE_UPDATE,
  ],

  [UserRole.DRIVER]: [
    Permission.COURSE_READ,
    Permission.DRIVER_READ,
    Permission.STATION_READ,
    Permission.GEOLOCATION_UPDATE, // ✅ envoyer sa position
    Permission.QUEUE_READ, // ✅ voir le tour de rôle
    Permission.QUEUE_UPDATE, // ✅ rejoindre/quitter la file
  ],
};

/** Vérifie si un rôle possède une permission donnée. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
