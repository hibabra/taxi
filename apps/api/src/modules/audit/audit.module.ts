import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '../tenancy/tenancy.module';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

/**
 * Module Audit — journal d'audit immuable.
 *
 * Ce module :
 * - Enregistre l'entité AuditLog dans TypeORM
 * - Expose AuditService (insert-only) et AuditInterceptor
 * - Fournit un endpoint GET /admin/audit-logs (SUPER_ADMIN)
 *
 * L'intercepteur est enregistré globalement dans AppModule
 * via APP_INTERCEPTOR. Les modules métier n'ont pas besoin
 * d'importer AuditModule explicitement.
 */
@Module({
  imports: [TenancyModule, TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
