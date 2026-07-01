export const DRIVER_POSITION_KEY = (driverId: string) => `driver:position:${driverId}`;

export const DRIVER_STATUS_KEY = (driverId: string) => `driver:status:${driverId}`;

export const GROUPEMENT_DRIVERS_KEY = (groupementId: string) =>
  `groupement:drivers:${groupementId}`;

export const POSITION_TTL_SECONDS = 300;

export const DRIVER_NOT_FOUND = 'Chauffeur introuvable';
export const INVALID_STATUS_TRANSITION = 'Changement de statut non autorisé';
