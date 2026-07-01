# Taxi Kiwi - Guide fonctionnel et technique Frontend

Date : 3 mai 2026

Ce document decrit le frontend cible de Taxi Kiwi, surtout le backoffice `apps/admin`.
Il doit servir de contrat avant implementation : structure, UX, bibliotheques, consommation API,
authentification, shadcn/ui, gestion des roles, formulaires, cache et normes de code.

Le backend a deja fixe les regles metier principales :

- pas de signup libre ;
- `SUPER_ADMIN` se connecte avec email + mot de passe ;
- admin de groupement = chauffeur promu admin ;
- chauffeur/admin groupement se connecte avec `groupementCode + identifiant chauffeur + mot de passe` ;
- les identifiants `T1`, `T2`, etc. sont uniques par groupement ;
- le `SUPER_ADMIN` peut entrer dans un groupement via le contexte `x-groupement-id` ;
- `SUPERVISOR` est retire du code applicatif.

---

## 1. Objectif du frontend

Le frontend doit etre une application operationnelle, pas une landing page.

Premier ecran attendu apres login :

- tableau de bord dense et lisible ;
- selection du groupement pour le `SUPER_ADMIN` ;
- vue de gestion des chauffeurs ;
- invitation chauffeur ;
- promotion/remplacement admin du groupement ;
- suivi clients/courses/audit ;
- design sombre, professionnel, rapide a scanner.

L'interface doit traduire exactement les flux backend :

- aucun bouton de signup libre ;
- toute creation de chauffeur passe par invitation ;
- la notion `T1`, `T2` doit etre visible et comprise dans les tables ;
- l'admin de groupement doit etre presente comme chauffeur + badge admin ;
- le super admin peut comparer les groupements et entrer dans un contexte groupement.

---

## 2. Stack cible

Application : `apps/admin`

Stack cible :

| Besoin              | Bibliotheque / outil        | Role                                              |
| ------------------- | --------------------------- | ------------------------------------------------- |
| Framework           | `next`                      | App Router, routes auth/dashboard, SSR si utile.  |
| UI runtime          | `react`, `react-dom`        | Composants interactifs.                           |
| Langage             | `typescript`                | Types stricts API, props, formulaires.            |
| Styling             | `tailwindcss`               | Design system sombre, layout dense.               |
| UI components       | `shadcn/ui`                 | Composants copiables, accessibles, customisables. |
| Validation          | `zod`                       | Schemas formulaires + DTO frontend.               |
| Formulaires         | `react-hook-form`           | Form state performant.                            |
| Data fetching/cache | `@tanstack/react-query`     | Cache, mutations, invalidations.                  |
| HTTP client         | `ky`                        | Client API typable, hooks auth, erreurs propres.  |
| Auth/session        | `next-auth` / Auth.js       | Facade session, credentials provider, logout.     |
| Icons               | `lucide-react`              | Icones de navigation, boutons et statuts.         |
| Notifications       | `sonner`                    | Toasts mutation success/error.                    |
| Theme               | `next-themes` si necessaire | Theme sombre force ou configurable plus tard.     |

Statut actuel :

- `next`, `react`, `react-dom`, `typescript`, `tailwindcss` sont presents ;
- `shadcn/ui` est initialise avec `components.json` ;
- `lucide-react`, `zod`, `react-hook-form`, `@tanstack/react-query`, `ky`, `next-auth`,
  `next-themes`, `sonner` et `zustand` sont installes ;
- le premier backoffice sombre est en place avec shell, dashboard, login, invitation chauffeur,
  state management et client API.

Reference officielle shadcn/ui :

- installation Next.js : https://ui.shadcn.com/docs/installation/next
- `components.json` : https://ui.shadcn.com/docs/components-json

---

## 3. Installation shadcn/ui cible

Dans `apps/admin`, initialiser shadcn/ui :

```bash
cd apps/admin
pnpm dlx shadcn@latest init
```

Pour Tailwind v4, la doc officielle indique que le champ `tailwind.config` dans
`components.json` peut rester vide. L'application actuelle utilise deja Tailwind v4.

Composants shadcn/ui a ajouter au debut :

```bash
pnpm dlx shadcn@latest add button input label form select dialog sheet dropdown-menu table tabs badge separator scroll-area skeleton tooltip popover command calendar textarea switch checkbox
```

Composants optionnels utiles ensuite :

```bash
pnpm dlx shadcn@latest add alert alert-dialog avatar breadcrumb card sonner pagination
```

Regle importante : shadcn/ui n'est pas une librairie noire.
Les composants sont copies dans le repo, probablement dans :

```text
apps/admin/src/components/ui
```

On peut donc les adapter aux tokens Taxi Kiwi, mais sans casser leur accessibilite Radix.

---

## 4. Design system Taxi Kiwi

Direction visuelle :

- sombre par defaut ;
- contraste fort ;
- style backoffice operationnel, pas marketing ;
- information dense, lisible, rapide ;
- cards uniquement pour elements repetes ou panneaux reels ;
- pas de grosses sections hero ;
- pas de decoration gratuite ;
- le logo Taxi Kiwi doit etre visible dans le premier viewport.

Palette cible :

| Token        | Couleur   | Usage                                  |
| ------------ | --------- | -------------------------------------- |
| `bg`         | `#060805` | fond principal                         |
| `surface`    | `#0D120B` | surfaces layout                        |
| `panel`      | `#11180F` | panneaux et tables                     |
| `panel-soft` | `#172012` | hover/selection                        |
| `border`     | `#27331F` | bordures fines                         |
| `text`       | `#F7FAEF` | texte principal                        |
| `muted`      | `#A9B49D` | texte secondaire                       |
| `kiwi`       | `#9DD51D` | action principale, etat actif          |
| `kiwi-soft`  | `#D7FF4F` | focus, badges importants               |
| `amber`      | `#F3C74F` | avertissements, invitations en attente |
| `cyan`       | `#4AC7D9` | information technique, API, audit      |
| `danger`     | `#F26D6D` | erreurs et actions destructives        |

Typographie :

- sans serif : `Geist` ou `Inter` ;
- mono : `Geist Mono` ou `JetBrains Mono` pour IDs, routes API, `T1`, tokens ;
- pas de font-size base qui scale avec la largeur viewport ;
- pas de letter-spacing negatif.

Rayons :

- boutons et inputs : `6px` a `8px` ;
- cards/panels : maximum `8px` ;
- tables : bordures fines, hover sobre.

---

## 5. Structure cible du projet

Structure recommandee :

```text
apps/admin/src
  app
    layout.tsx
    globals.css
    providers.tsx
    login
      page.tsx
    accept-driver-invitation
      [token]
        page.tsx
    (backoffice)
      layout.tsx
      dashboard
        page.tsx
      groupements
        page.tsx
        [groupementId]
          page.tsx
      chauffeurs
        page.tsx
      invitations
        page.tsx
      utilisateurs
        page.tsx
      clients
        page.tsx
      courses
        page.tsx
      audit
        page.tsx
      parametres
        page.tsx
  components
    ui
      button.tsx
      input.tsx
      table.tsx
      ...
    layout
      app-shell.tsx
      sidebar.tsx
      topbar.tsx
      groupement-switcher.tsx
      user-menu.tsx
    brand
      taxi-kiwi-logo.tsx
    features
      auth
      groupements
      drivers
      users
      clients
      courses
      audit
  lib
    api
      client.ts
      errors.ts
      auth.api.ts
      groupements.api.ts
      drivers.api.ts
      users.api.ts
      clients.api.ts
      courses.api.ts
      audit.api.ts
      query-keys.ts
    auth
      auth-options.ts
      roles.ts
      session.ts
      guards.ts
    validations
      auth.schema.ts
      driver.schema.ts
      groupement.schema.ts
      client.schema.ts
      course.schema.ts
    utils
      cn.ts
      format.ts
      roles.ts
  types
    next-auth.d.ts
```

Regles :

- pas d'appel `fetch` direct dans les composants de page ;
- les appels backend passent par `lib/api/*.api.ts` ;
- les schemas formulaires sont centralises dans `lib/validations` ;
- les types metier viennent de `@taxikiwi/shared-types` ;
- les constantes roles/permissions viennent de `@taxikiwi/shared-config` ;
- les validations communes viennent de `@taxikiwi/shared-validators` ;
- les composants shadcn/ui restent dans `components/ui` ;
- les composants metier restent dans `components/features`.

---

## 6. Routes frontend cible

### 6.1 Auth

| Route frontend                     | Role utilisateur               | Backend consomme                                  |
| ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| `/login`                           | Super admin ou admin/chauffeur | Choix du mode login.                              |
| `/accept-driver-invitation/:token` | Chauffeur invite               | `POST /api/v1/drivers/invitations/:token/accept`  |
| `/reset-password/:token`           | User invite/reset              | `POST /api/v1/users/reset-password/:token/accept` |

Important :

- ne pas creer de page `/signup` ;
- ne pas proposer "creer mon compte" librement ;
- l'inscription chauffeur est seulement l'acceptation d'une invitation.

### 6.2 Dashboard

| Route frontend     | Role cible               | Description                                           |
| ------------------ | ------------------------ | ----------------------------------------------------- |
| `/`                | Authentifie              | Redirection selon role.                               |
| `/dashboard`       | `ADMIN` ou `SUPER_ADMIN` | Synthese operations.                                  |
| `/groupements`     | `SUPER_ADMIN`            | Liste, creation, edition, desactivation, suppression. |
| `/groupements/:id` | `SUPER_ADMIN`            | Detail, edition, parametres et actions groupement.    |
| `/chauffeurs`      | `ADMIN`                  | Liste chauffeurs du groupement courant.               |
| `/invitations`     | `ADMIN`                  | Creation d'invitations chauffeur.                     |
| `/utilisateurs`    | `ADMIN`                  | Users lies au groupement courant.                     |
| `/clients`         | `ADMIN`                  | Clients du groupement courant.                        |
| `/courses`         | `ADMIN`                  | Courses manuelles Vague 1.                            |
| `/audit`           | `SUPER_ADMIN`            | Audit logs et filtres.                                |
| `/parametres`      | `ADMIN`                  | Session et contexte groupement.                       |

---

## 7. Authentification frontend

### 7.1 Modes de login

Mode plateforme :

```http
POST /api/v1/auth/platform/login
```

Payload :

```json
{
  "email": "superadmin@taxikiwi.local",
  "password": "StrongPassword123!"
}
```

Mode groupement :

```http
POST /api/v1/auth/groupement/login
```

Payload :

```json
{
  "groupementCode": "TAXI-KIWI",
  "identifier": "T1",
  "password": "StrongPassword123!"
}
```

On n'utilise pas `/api/v1/auth/login` dans le nouveau frontend sauf compatibilite historique.

### 7.2 Strategy NextAuth / Auth.js

Approche recommandee :

- utiliser `next-auth` comme facade de session frontend ;
- utiliser un `CredentialsProvider` pour chaque mode :
  - `platform`;
  - `groupement`;
- appeler le backend dans `authorize()`;
- stocker dans la session :
  - `accessToken`;
  - `expiresIn`;
  - `user.id`;
  - `user.email`;
  - `user.roles`;
  - `user.groupementId`;
  - `user.driverId`;
  - `user.driverIdentifier`;
  - `user.isGroupAdmin`;
- ne jamais stocker le refresh token dans `localStorage`.

Le backend pose deja un cookie refresh HttpOnly.
Si le backoffice et l'API ne sont pas sur le meme domaine, il faudra passer par des Route Handlers
Next.js pour relayer proprement les cookies `Set-Cookie`.

### 7.3 Logout

Le logout doit appeler :

```http
POST /api/v1/auth/logout
```

Puis :

- vider la session NextAuth ;
- invalider les caches React Query ;
- rediriger vers `/login`.

---

## 8. Consommation API backend

### 8.1 Variables d'environnement

Fichier cible : `apps/admin/.env.local`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
API_BASE_URL=http://localhost:3000/api/v1
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=change-me
```

Regle :

- `NEXT_PUBLIC_API_BASE_URL` peut etre lu cote navigateur ;
- `API_BASE_URL` est reserve aux route handlers/server actions ;
- les secrets restent cote serveur.

### 8.2 Client `ky`

Fichier cible :

```text
apps/admin/src/lib/api/client.ts
```

Responsabilites :

- prefixer toutes les routes par `API_BASE_URL` ;
- ajouter `Authorization: Bearer <accessToken>` ;
- ajouter `x-groupement-id` quand un `SUPER_ADMIN` a selectionne un groupement ;
- envoyer `credentials: "include"` pour les cookies refresh si meme origine ;
- transformer les erreurs backend en erreurs UI lisibles.

Pseudo-code :

```ts
export const api = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAccessToken();
        const selectedGroupementId = getSelectedGroupementId();

        if (token) request.headers.set('Authorization', `Bearer ${token}`);
        if (selectedGroupementId) request.headers.set('x-groupement-id', selectedGroupementId);
      },
    ],
  },
});
```

### 8.3 Format d'erreur backend

Le backend retourne des erreurs normalisees :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "La requete contient des erreurs de validation",
  "details": [],
  "timestamp": "2026-05-03T00:00:00.000Z",
  "path": "/api/v1/drivers/invitations",
  "requestId": "..."
}
```

Le frontend doit mapper :

- `VALIDATION_ERROR` -> erreurs de champs si possible ;
- `UNAUTHORIZED` -> redirection login ou refresh ;
- `FORBIDDEN` -> ecran "acces refuse" ;
- `CONFLICT` -> message metier dans toast/form ;
- `TENANT_MISSING` -> demander au super admin de choisir un groupement.

---

## 9. Services API frontend

### 9.1 Auth

```text
lib/api/auth.api.ts
```

Fonctions :

- `platformLogin(dto)`;
- `groupementLogin(dto)`;
- `refreshSession()`;
- `logout()`;
- `getMe()`;
- `changePassword(dto)`.

### 9.2 Groupements

Endpoints backend :

- `GET /api/v1/groupements`
- `GET /api/v1/groupements/:id`
- `POST /api/v1/groupements`
- `PATCH /api/v1/groupements/:id`
- `PATCH /api/v1/groupements/:id/settings`
- `PATCH /api/v1/groupements/:id/deactivate`
- `DELETE /api/v1/groupements/:id`

Frontend :

- table groupements ;
- filtres actif/inactif/recherche ;
- drawer/dialog creation ;
- dialog edition ;
- action desactivation ;
- action suppression definitive avec confirmation ;
- page detail ;
- action "entrer dans le groupement" ;

### 9.3 Chauffeurs

Endpoints backend :

- `GET /api/v1/drivers`
- `GET /api/v1/drivers/:id`
- `POST /api/v1/drivers/invitations`
- `POST /api/v1/drivers/invitations/:token/accept`
- `POST /api/v1/drivers`
- `PATCH /api/v1/drivers/:id`
- `POST /api/v1/drivers/:id/suspend`
- `POST /api/v1/drivers/:id/reactivate`
- `DELETE /api/v1/drivers/:id`

Frontend :

- table chauffeurs avec `driverIdentifier` visible ;
- badge `Admin groupement` si `isGroupAdmin`;
- statut `ACTIVE`, `SUSPENDED`, etc. ;
- bouton inviter taxi ;
- formulaire invitation :
  - email ;
  - ville de licence ;
  - numero de licence ;
- page acceptation invitation :
  - mot de passe ;
  - prenom/nom/telephone ;
  - infos vehicule si necessaire ;
  - affichage de l'identifiant genere apres acceptation.

### 9.4 Users

Le module users reste utile pour certains comptes backoffice classiques, mais la cible admin
groupement doit passer par chauffeur promu.

Endpoints :

- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `POST /api/v1/users/invitations`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id`
- `POST /api/v1/users/:id/reset-password`

UI :

- section secondaire, pas le coeur du flux admin chauffeur.

### 9.5 Clients et courses

Clients :

- liste ;
- recherche telephone ;
- creation/edition ;
- adresses ;
- blacklist/unblacklist ;
- archive/unarchive.

Courses Vague 1 :

- liste ;
- creation manuelle ;
- correction ;
- suppression.

### 9.6 Audit

Endpoint :

- `GET /api/v1/admin/audit-logs`

UI :

- reserve `SUPER_ADMIN` ;
- filtres action, user, groupement, dates ;
- afficher les actions auth nouvellement loggees :
  - `AUTH_LOGIN`;
  - `AUTH_REFRESH`;
  - `AUTH_LOGOUT`;
  - `AUTH_PASSWORD_CHANGED`;
  - `AUTH_TOKEN_REUSE_DETECTED`.

---

## 10. React Query

Fichier :

```text
lib/api/query-keys.ts
```

Convention :

```ts
export const queryKeys = {
  me: ['me'] as const,
  groupements: (filters: GroupementFilters) => ['groupements', filters] as const,
  groupement: (id: string) => ['groupement', id] as const,
  drivers: (groupementId: string, filters: DriverFilters) =>
    ['drivers', groupementId, filters] as const,
  clients: (groupementId: string, filters: ClientFilters) =>
    ['clients', groupementId, filters] as const,
  courses: (groupementId: string, filters: CourseFilters) =>
    ['courses', groupementId, filters] as const,
};
```

Invalidations importantes :

| Mutation                     | Invalider                                          |
| ---------------------------- | -------------------------------------------------- |
| invitation chauffeur creee   | `drivers`, `driverInvitations`                     |
| invitation acceptee          | `drivers`, `me`                                    |
| chauffeur suspendu/reactive  | `drivers`, `driver(id)`                            |
| admin groupement change      | `drivers`, `groupement(id)`, `me` si concerne user |
| groupement modifie/desactive | `groupements`, `groupement(id)`, `me`              |
| client modifie               | `clients`, `client(id)`                            |
| course modifiee              | `courses`, `course(id)`                            |

---

## 11. Validation avec Zod et React Hook Form

Chaque formulaire doit avoir :

- un schema Zod ;
- un type `z.infer<typeof schema>` ;
- un `useForm` avec resolver Zod ;
- erreurs affichees via shadcn `FormMessage`.

Exemple invitation chauffeur :

```ts
export const createDriverInvitationSchema = z.object({
  email: z.string().email(),
  licenseCity: z.string().max(128).optional(),
  licenseNumber: z.string().min(1).max(64),
});
```

Exemple login groupement :

```ts
export const groupementLoginSchema = z.object({
  groupementCode: z.string().min(1).max(64),
  identifier: z.string().regex(/^T[0-9]+$/i),
  password: z.string().min(8),
});
```

Les schemas frontend doivent rester alignes avec les DTO backend.

---

## 12. Gestion des roles et permissions

Roles visibles dans le frontend :

```ts
type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER' | 'DISPATCHER';
```

Regles UI :

- `SUPER_ADMIN` voit :
  - groupements ;
  - audit ;
  - selection groupement ;
  - statistiques par groupement ;
  - promotion admin chauffeur.
- `ADMIN` voit :
  - dashboard groupement ;
  - chauffeurs ;
  - invitations ;
  - clients ;
  - courses ;
  - settings groupement.
- `DRIVER` sans `isGroupAdmin` ne doit pas acceder au backoffice.
- `DISPATCHER` est conserve pour futur besoin, pas utilise dans l'acces backoffice actuel.

Le frontend ne remplace jamais la securite backend.
Il masque les vues non autorisees, mais le backend reste l'autorite.

---

## 13. Layout et navigation

Backoffice cible :

- sidebar gauche fixe sur desktop ;
- topbar avec :
  - recherche rapide ;
  - selection groupement pour super admin ;
  - statut API ;
  - menu utilisateur ;
- contenu principal dense ;
- tables avec actions rapides ;
- drawers/dialogs pour creation/edition ;
- pages detail pour operations lourdes.

Navigation `SUPER_ADMIN` :

- Vue plateforme ;
- Groupements ;
- Audit ;
- Parametres plateforme.

Navigation `ADMIN` :

- Dashboard ;
- Chauffeurs ;
- Invitations ;
- Clients ;
- Courses ;
- Parametres.

---

## 14. Composants metier prioritaires

### 14.1 `GroupementSwitcher`

Visible pour `SUPER_ADMIN`.

Responsabilites :

- lister les groupements ;
- choisir le groupement courant ;
- stocker le `selectedGroupementId` dans session/store frontend ;
- forcer le header `x-groupement-id` sur les requetes tenant-scoped.

### 14.2 `DriverIdentifierBadge`

Affiche `T1`, `T2`, etc.

Style :

- mono ;
- badge compact ;
- couleur kiwi/cyan ;
- tooltip expliquant que l'identifiant est unique dans le groupement.

### 14.3 `InviteDriverDialog`

Formulaire :

- email ;
- ville de licence ;
- numero de licence ;
- bouton envoyer ;
- feedback toast ;
- pas de creation directe de compte.

### 14.4 `AssignGroupAdminDialog`

Visible pour `SUPER_ADMIN`.

Flux :

1. ouvrir depuis detail groupement ;
2. afficher chauffeurs actifs du groupement ;
3. choisir un chauffeur ;
4. confirmer ;
5. appeler `POST /groupements/:id/admin-driver/:driverId`;
6. invalider caches.

### 14.5 `AuditTimeline`

Affiche les actions sensibles :

- login ;
- logout ;
- changement admin groupement ;
- invitation chauffeur ;
- activation invitation ;
- suspension/reactivation.

---

## 15. Normes UI/UX

Regles :

- chaque bouton icon-only doit avoir un tooltip ;
- les actions destructives demandent confirmation ;
- les textes doivent tenir sur mobile et desktop ;
- pas de table sans etat vide ;
- pas de spinner seul sans contexte ;
- skeleton pour chargements longs ;
- toasts pour mutations ;
- erreurs formulaire au niveau champ + message global si besoin ;
- navigation clavier correcte ;
- focus visible en couleur `kiwi-soft`.

Etats obligatoires :

- loading ;
- empty ;
- error ;
- unauthorized ;
- forbidden ;
- success mutation ;
- validation error ;
- network offline / API indisponible.

---

## 16. Mobile/responsive

Le backoffice doit etre utilisable sur tablette et mobile, mais ce n'est pas l'app chauffeur mobile.

Regles :

- sidebar devient sheet mobile ;
- tables deviennent listes compactes si necessaire ;
- boutons critiques restent accessibles ;
- formulaires ne debordent pas ;
- colonnes secondaires peuvent etre masquees mais jamais les infos critiques :
  - nom ;
  - identifiant chauffeur ;
  - statut ;
  - action principale.

L'application chauffeur mobile pourra etre une future PWA ou app mobile separee.

---

## 17. Tests et verification frontend

Commandes minimales :

```bash
pnpm --filter admin lint
pnpm --filter admin build
```

Tests a ajouter ensuite :

- tests composants avec Testing Library ;
- tests e2e avec Playwright ;
- verification visuelle desktop/mobile ;
- verification accessibilite axe ;
- tests des guards de route ;
- tests du client API sur erreurs backend.

Avant livraison UI :

- verifier screenshot desktop ;
- verifier screenshot mobile ;
- verifier que les textes ne se chevauchent pas ;
- verifier que les icons/menus sont utilisables au clavier ;
- verifier que le theme sombre reste lisible.

---

## 18. Plan d'implementation recommande

### Phase 1 - Fondation UI

- installer shadcn/ui ;
- ajouter `cn()`;
- configurer tokens sombres ;
- creer layout `AppShell`;
- creer logo Taxi Kiwi ;
- ajouter providers React Query/Auth/Toaster.

### Phase 2 - Auth

- ecran login avec deux modes :
  - plateforme ;
  - groupement ;
- integration NextAuth/Auth.js ;
- route guards ;
- logout.

### Phase 3 - Super admin

- dashboard plateforme ;
- liste groupements ;
- detail groupement ;
- switcher groupement ;
- promotion admin chauffeur.

### Phase 4 - Admin groupement

- dashboard groupement ;
- chauffeurs ;
- invitation chauffeur ;
- clients ;
- courses.

### Phase 5 - Audit et finitions

- audit logs ;
- empty/loading/error states ;
- responsive ;
- tests ;
- documentation des composants.

---

## 19. Decisions importantes

1. Pas de signup libre dans le frontend.
2. Le login super admin reste email/password.
3. Le login groupement demande `groupementCode`, `identifier`, `password`.
4. L'admin de groupement est affiche comme chauffeur avec `isGroupAdmin`.
5. Le `SUPER_ADMIN` change le contexte groupement via `x-groupement-id`.
6. shadcn/ui sera utilise comme base de composants, pas comme theme generique.
7. Le design sera sombre, dense, operationnel.
8. Le frontend doit consommer les endpoints backend reels, pas inventer de flux parallele.
