// ── Type de zone géographique ────────────────────────────────
export enum StationType {
  CIRCLE = 'CIRCLE',
  POLYGON = 'POLYGON',
}

// ── Messages d'audit ─────────────────────────────────────────
export const STATION_CREATED = 'STATION_CREATED';
export const STATION_UPDATED = 'STATION_UPDATED';
export const STATION_DELETED = 'STATION_DELETED';

// ── Messages d'erreur ────────────────────────────────────────
export const STATION_NOT_FOUND = 'Station introuvable';
export const STATION_NAME_DUPLICATE = 'Une station avec ce nom existe déjà dans ce groupement';
export const STATION_INVALID_TYPE =
  'Un cercle requiert latitude/longitude/rayon, un polygone requiert au moins 3 points';
