/**
 * Structure de pagination standardisée pour toutes les réponses
 * de type liste de l'API TaxiKiwi.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  /** Page courante (1-indexed). */
  page: number;
  /** Nombre d'éléments par page. */
  limit: number;
  /** Nombre total d'éléments. */
  total: number;
  /** Nombre total de pages. */
  totalPages: number;
  /** Existe-t-il une page suivante ? */
  hasNextPage: boolean;
  /** Existe-t-il une page précédente ? */
  hasPreviousPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
