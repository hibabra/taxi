/**
 * Rôles utilisateur du backoffice.
 *
 * Ces valeurs sont définies localement car le `tsconfig.json`
 * de l'API utilise `moduleResolution: "nodenext"` qui ne résout pas
 * les exports `.ts` source de `@taxikiwi/shared-config`.
 * La source de vérité reste `packages/shared-config/src/roles.ts`
 * — garder ces valeurs synchronisées.
 *
 * TODO(infra): Éliminer cette duplication en configurant `shared-config`
 * pour exporter des fichiers `.js` compilés avec `.d.ts` :
 * 1. Ajouter un script `build` dans `packages/shared-config/package.json`
 * 2. Configurer `exports` dans le package.json avec les chemins `.js`
 * 3. Ajouter `shared-config` au pipeline `turbo build`
 * 4. Supprimer ce fichier et importer depuis `@taxikiwi/shared-config`
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}
