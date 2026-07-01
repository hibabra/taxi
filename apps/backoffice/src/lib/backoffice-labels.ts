import type { CourseStatus, DispatchPolicy, DriverStatus, UserRole } from '@taxikiwi/shared-types';

type BadgeTone = 'default' | 'secondary' | 'destructive' | 'outline';

export const DRIVER_STATUS_LABELS: Record<DriverStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Actif', tone: 'default' },
  OFFBOARDED: { label: 'Sorti', tone: 'destructive' },
  SUSPENDED: { label: 'Suspendu', tone: 'outline' },
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, { label: string; tone: BadgeTone }> = {
  CANCELLED: { label: 'Annulée', tone: 'destructive' },
  COMPLETED: { label: 'Terminée', tone: 'default' },
  NO_SHOW: { label: 'Client absent', tone: 'outline' },
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin groupement',
  DRIVER: 'Chauffeur',
  SUPER_ADMIN: 'Super admin',
};

export const DISPATCH_POLICY_LABELS: Record<DispatchPolicy, string> = {
  DISTANCE_FIRST: 'Plus proche',
  FREE_FIRST: 'Premier disponible',
  STATION_FIRST: 'Ordre station',
};

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('fr-FR', {
    currency: 'EUR',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

export function formatDistance(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPhone(value: null | string): string {
  return value?.trim() || '-';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
