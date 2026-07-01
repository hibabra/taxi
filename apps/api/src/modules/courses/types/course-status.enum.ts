/**
 * Statut minimal d'une course saisie manuellement en Vague 1.
 *
 * Les états opérationnels riches (dispatch, prise en charge, fin GPS)
 * arriveront en Vague 3 avec les appels et le suivi mobile.
 */
export enum CourseStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}
