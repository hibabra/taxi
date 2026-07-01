import { BadRequestException, createParamDecorator } from '@nestjs/common';

import { TenantContext } from '../tenant-context';

/**
 * Décorateur de paramètre qui injecte le groupementId courant
 * directement dans les paramètres du controller.
 *
 * @example
 * @Get()
 * findAll(@CurrentTenant() groupementId: string) {
 *   return this.service.findAllByGroupement(groupementId);
 * }
 */
export const CurrentTenant = createParamDecorator((): string => {
  try {
    return TenantContext.getGroupementId();
  } catch {
    throw new BadRequestException({
      code: 'TENANT_MISSING',
      details: [],
      message: 'Sélectionnez un groupement avant de continuer.',
    });
  }
});
