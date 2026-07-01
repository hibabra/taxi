import { Module } from '@nestjs/common';

import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenancyService } from './tenancy.service';

/**
 * Module Tenancy — garant de l'isolation multi-tenant.
 *
 * Ce module :
 * - Expose TenantContextInterceptor pour initialiser le contexte après JwtAuthGuard
 * - Expose TenancyService pour la propagation RLS
 * - Exporte TenancyService pour injection dans les modules métier
 *
 * Les routes publiques (/health, /ready, /auth/login) sont gérées
 * gracieusement : sans `request.user`, aucun contexte tenant n'est initialisé.
 */
@Module({
  providers: [TenancyService, TenantContextInterceptor],
  exports: [TenancyService, TenantContextInterceptor],
})
export class TenancyModule {}
