export type BackendErrorPayload = {
  code?: string;
  details?: unknown[];
  message: string;
  path?: string;
  requestId?: string;
  statusCode: number;
  timestamp?: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly details: unknown[];
  readonly path?: string;
  readonly requestId?: string;
  readonly statusCode: number;

  constructor(payload: BackendErrorPayload) {
    super(payload.message || fallbackMessageFromStatus(payload.statusCode));
    this.name = 'ApiError';
    this.code = payload.code ?? `HTTP_${payload.statusCode}`;
    this.details = payload.details ?? [];
    this.path = payload.path;
    this.requestId = payload.requestId;
    this.statusCode = payload.statusCode;
  }
}

export function userFacingApiTitle(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return 'Session expirée';
    if (error.statusCode === 403) return 'Accès refusé';
    if (error.statusCode === 404) return 'Donnée introuvable';
    if (error.statusCode === 409) return 'Conflit de données';
    if (error.statusCode === 429) return 'Trop de tentatives';
    if (error.statusCode >= 500) return 'Erreur serveur';
    if (error.statusCode >= 400) return 'Données refusées';
    return 'Erreur API';
  }

  if (isNetworkError(error)) {
    return 'API injoignable';
  }

  return 'Erreur inattendue';
}

export function userFacingApiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TENANT_MISSING') {
      return 'Choisissez un groupement avant de continuer.';
    }

    const detailText = formatDetails(error.details);
    const message = detailText ? `${error.message} ${detailText}` : error.message;

    if (error.statusCode === 401) {
      return 'Votre session a expiré. Reconnectez-vous pour continuer.';
    }

    if (error.statusCode === 403 || error.code === 'FORBIDDEN') {
      return "Vous n'avez pas les droits pour cette action.";
    }

    if (error.statusCode === 409 || error.code === 'CONFLICT') {
      return withRequestId(
        message || 'Cette opération entre en conflit avec une donnée existante.',
        error.requestId,
      );
    }

    if (error.statusCode === 429) {
      return withRequestId(
        message || 'Trop de tentatives. Patientez quelques instants avant de réessayer.',
        error.requestId,
      );
    }

    if (error.statusCode >= 500) {
      return withRequestId(message || "Le serveur n'a pas pu traiter la demande.", error.requestId);
    }

    return withRequestId(message || fallbackMessageFromStatus(error.statusCode), error.requestId);
  }

  if (isNetworkError(error)) {
    return "Impossible de joindre l'API. Vérifiez que le backend est lancé et que l'URL API est correcte.";
  }

  return 'Une erreur inattendue est survenue.';
}

function fallbackMessageFromStatus(statusCode: number): string {
  if (statusCode === 400) return 'La demande contient des données invalides.';
  if (statusCode === 401) return 'Authentification requise.';
  if (statusCode === 403) return 'Action non autorisée.';
  if (statusCode === 404) return 'La donnée demandée est introuvable.';
  if (statusCode === 409) return 'Une donnée existe déjà ou bloque cette action.';
  if (statusCode === 429) return 'Trop de tentatives. Réessayez dans quelques instants.';
  if (statusCode >= 500) return "Le serveur n'a pas pu traiter la demande.";
  return 'La demande a été refusée par l’API.';
}

function formatDetails(details: unknown[]): string {
  const messages = details.map(detailToMessage).filter(Boolean);
  const uniqueMessages = Array.from(new Set(messages));

  if (uniqueMessages.length === 0) {
    return '';
  }

  return `Détail : ${uniqueMessages.slice(0, 3).join(' ')}`;
}

function detailToMessage(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }

  if (!detail || typeof detail !== 'object') {
    return null;
  }

  const candidate = detail as Record<string, unknown>;
  const reason = pickString(candidate.reason) ?? pickString(candidate.message);
  const field = pickString(candidate.field) ?? pickString(candidate.property);

  if (field && reason) {
    return `${field} : ${reason}`;
  }

  return reason;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function withRequestId(message: string, requestId?: string): string {
  return requestId ? `${message} Référence API : ${requestId}.` : message;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TypeError' ||
    error.name === 'TimeoutError' ||
    /failed to fetch|network|load failed|timeout/i.test(error.message)
  );
}
