/**
 * Statut métier d'un chauffeur.
 *
 * ACTIVE      : disponible dans le groupement
 * SUSPENDED   : temporairement indisponible, réversible
 * OFFBOARDED  : sorti du groupement, transition finale côté API
 */
export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  OFFBOARDED = 'OFFBOARDED',
}
