import { SetMetadata } from '@nestjs/common';

/**
 * Clé de metadata pour le décorateur @Auditable().
 * @internal
 */
export const AUDIT_ACTION_KEY = 'audit:action';

/**
 * Décorateur de controller qui marque une méthode pour l'audit automatique.
 *
 * L'AuditInterceptor global détecte cette metadata et enregistre
 * automatiquement une entrée dans `audit_logs` avec les valeurs
 * before/after et le contexte de la requête.
 *
 * @param action - Code d'action standardisé (ex: 'DRIVER_CREATED')
 *   Doit correspondre à une valeur de AuditAction
 *   dans packages/shared-config/src/audit-actions.ts.
 *
 * @example
 * @Post()
 * @Auditable('DRIVER_CREATED')
 * async create(@Body() dto: CreateDriverDto) {
 *   return this.driversService.create(dto);
 * }
 */
export const Auditable = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
