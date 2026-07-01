import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Données du tenant stockées dans le contexte asynchrone.
 */
export interface TenantData {
  /** UUID du groupement courant. */
  groupementId: string;
  /** UUID de l'utilisateur courant (pour audit). */
  userId: string;
}

/**
 * Contexte tenant basé sur AsyncLocalStorage.
 *
 * Garantit l'isolation entre requêtes concurrentes :
 * chaque requête HTTP a son propre contexte tenant
 * qui ne fuit jamais vers les autres.
 *
 * Trois mécanismes de défense en profondeur :
 * 1. Ce contexte (applicatif)
 * 2. Le filtre WHERE dans les services (applicatif)
 * 3. PostgreSQL RLS (base de données)
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantData>();

  /**
   * Exécute un callback dans le contexte d'un tenant donné.
   * Toute lecture via `get()` ou `getOrNull()` à l'intérieur
   * du callback retournera les données de ce tenant.
   */
  static run<T>(data: TenantData, callback: () => T): T {
    return this.storage.run(data, callback);
  }

  /**
   * Retourne le tenant courant.
   * @throws Error si aucun contexte tenant n'est défini
   *         (route publique, ou appel hors middleware).
   */
  static get(): TenantData {
    const data = this.storage.getStore();

    if (!data) {
      throw new Error(
        'TenantContext.get() called outside of a tenant-scoped request. ' +
          'Ensure TenantContextInterceptor is registered and the route is not @Public().',
      );
    }

    return data;
  }

  /**
   * Retourne le tenant courant ou `null` si aucun n'est défini.
   * Utile pour les routes publiques où le tenant est optionnel.
   */
  static getOrNull(): TenantData | null {
    return this.storage.getStore() ?? null;
  }

  /**
   * Raccourci : retourne le groupementId courant.
   * @throws Error si aucun contexte tenant n'est défini.
   */
  static getGroupementId(): string {
    return this.get().groupementId;
  }

  /**
   * Raccourci : retourne le userId courant.
   * @throws Error si aucun contexte tenant n'est défini.
   */
  static getUserId(): string {
    return this.get().userId;
  }
}
