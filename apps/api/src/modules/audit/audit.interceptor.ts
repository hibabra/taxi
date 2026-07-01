import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY } from './decorators/auditable.decorator';

/**
 * Type minimal de requête Fastify pour l'extraction de contexte.
 */
interface AuditRequest {
  id?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: {
    id?: string;
    groupementId?: string | null;
    [key: string]: unknown;
  };
}

/**
 * Intercepteur global qui capture les actions auditables.
 *
 * Pour chaque méthode décorée @Auditable(action), l'intercepteur :
 * 1. Capture le contexte (user, IP, user-agent, requestId)
 * 2. Exécute le handler du controller
 * 3. Si succès, écrit une entrée dans audit_logs avec la réponse
 *
 * L'écriture d'audit ne bloque JAMAIS le flux métier.
 * En cas d'erreur d'écriture, l'erreur est loggée mais ignorée.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, context.getHandler());

    // Pas de décorateur @Auditable → on passe
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const userAgent = this.extractUserAgent(request);
    const ipAddress = request.ip ?? null;
    const requestId = request.id ?? null;
    const userId = request.user?.id;
    const groupementId = request.user?.groupementId;

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          // Écriture asynchrone — ne bloque pas la réponse
          void this.auditService.log({
            action,
            after: this.extractResourceData(responseBody),
            groupementId: groupementId ?? null,
            ipAddress: ipAddress ?? undefined,
            requestId: requestId ?? undefined,
            resourceId: this.extractResourceId(responseBody),
            resourceType: this.extractResourceType(context),
            userAgent: userAgent ?? undefined,
            userId,
          });
        },
        error: () => {
          // On n'audit pas les erreurs — seules les actions réussies sont tracées.
          // Les erreurs sont déjà capturées par le logger et le filtre d'exception.
        },
      }),
    );
  }

  private extractUserAgent(request: AuditRequest): string | null {
    const ua = request.headers?.['user-agent'];
    if (typeof ua === 'string') return ua.slice(0, 512);
    if (Array.isArray(ua) && ua.length > 0) return (ua[0] ?? '').slice(0, 512);
    return null;
  }

  /**
   * Essaie d'extraire l'ID de la ressource depuis la réponse du controller.
   * Convention : la réponse contient un champ `id`.
   */
  private extractResourceId(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'id' in body) {
      return String((body as Record<string, unknown>).id);
    }
    return undefined;
  }

  /**
   * Extrait le type de ressource depuis le nom du controller.
   * Ex: DriversController → Driver, UsersController → User
   */
  private extractResourceType(context: ExecutionContext): string | undefined {
    const controllerName = context.getClass().name;
    return controllerName.replace(/Controller$/, '');
  }

  /**
   * Extrait les données de la ressource pour le champ `after`.
   * Si la réponse est un objet, on le capture. Sinon null.
   */
  private extractResourceData(body: unknown): Record<string, unknown> | null {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  }
}
