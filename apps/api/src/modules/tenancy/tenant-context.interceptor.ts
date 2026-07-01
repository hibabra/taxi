import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import { UserRole } from '../auth/types/role.enum';
import { TenantContext, TenantData } from './tenant-context';

interface TenantRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: {
    id?: string;
    groupementId?: string | null;
    roles?: UserRole[];
    [key: string]: unknown;
  };
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const tenantData = this.extractTenantData(request);

    if (!tenantData) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      TenantContext.run(tenantData, () => {
        const subscription = next.handle().subscribe(subscriber);
        subscriber.add(subscription);
      });
    });
  }

  private extractTenantData(request: TenantRequest): TenantData | null {
    const userId = request.user?.id;
    const groupementId = request.user?.groupementId ?? this.extractSuperAdminTenant(request);

    if (!userId || !groupementId) {
      return null;
    }

    return { groupementId, userId };
  }

  private extractSuperAdminTenant(request: TenantRequest): string | null {
    const roles = request.user?.roles ?? [];

    if (!roles.includes(UserRole.SUPER_ADMIN)) {
      return null;
    }

    const rawHeader = request.headers?.['x-groupement-id'];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    return header?.trim() || null;
  }
}
