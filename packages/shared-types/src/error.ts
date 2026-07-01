/**
 * Format d'erreur standardisé de l'API (RFC 7807).
 */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details: ApiErrorDetail[];
  timestamp: string;
  path: string;
  requestId?: string;
}

export interface ApiErrorDetail {
  reason: string;
}
