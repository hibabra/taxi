import type { AuditLog, PaginatedResponse } from '@taxikiwi/shared-types';

import { compactSearchParams, type ApiClient } from './client';

export function listAuditLogs(
  client: ApiClient,
  params?: {
    action?: string;
    endDate?: string;
    groupementId?: string;
    limit?: number;
    page?: number;
    startDate?: string;
    userId?: string;
  },
) {
  return client
    .get('admin/audit-logs', { searchParams: compactSearchParams(params) })
    .json<PaginatedResponse<AuditLog>>();
}
