# TaxiKiwi API — Architecture & État d'avancement

> **Dernière mise à jour** : 2 mai 2026
> **Référence** : `taxikiwi-wave1-guide.html`

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Stack technique](#stack-technique)
3. [Architecture des dossiers](#architecture-des-dossiers)
4. [Sprint 0 — Fondations (terminé ✅)](#sprint-0--fondations-terminé-)
5. [Sprint 1 — Modules Core, Auth, Tenancy, Audit (terminé ✅)](#sprint-1--modules-core-auth-tenancy-audit-terminé-)
6. [Packages partagés](#packages-partagés)
7. [Migrations](#migrations)
8. [Flux de requête HTTP](#flux-de-requête-http)
9. [Sécurité](#sécurité)
10. [Sprint 2 — Modules métier](#sprint-2--modules-métier-couche-2--acteurs)

---

## Vue d'ensemble

TaxiKiwi est une plateforme SaaS multi-tenant de gestion de groupements de taxis.
L'API est le cœur du système : elle alimente le backoffice Next.js et, à terme,
l'application mobile des chauffeurs.

La **Vague 1** livre 8 modules dans l'ordre de leurs dépendances :

```
Couche 1 — Fondations : Core → Auth → Tenancy → Audit       ← Sprint 0 + Sprint 1 (terminés)
Couche 2 — Acteurs    : Groupements → Users → Drivers → Clients  ← Sprint 2 (en cours)
Couche 4 — Opérations : Courses (squelette)                  ← Sprint 2 ✅
```

---

## Stack technique

| Brique              | Choix                                  | Pourquoi                                              |
| ------------------- | -------------------------------------- | ----------------------------------------------------- |
| **Runtime**         | Node.js 24.13.0                        | Version verrouillée par `.nvmrc` et `package.json`    |
| **Framework**       | NestJS 11                              | Architecture modulaire, injection de dépendances      |
| **HTTP**            | Fastify                                | 2x plus rapide qu'Express, typed-safe                 |
| **Base de données** | PostgreSQL 16                          | RLS, JSONB, partitionnement, fiable                   |
| **ORM**             | TypeORM                                | Migrations, entités décorées, QueryBuilder            |
| **Cache / Queue**   | Redis + BullMQ                         | Sessions, rate limiting, jobs async                   |
| **Auth**            | Passport + JWT                         | Access token (body) + refresh token (cookie HttpOnly) |
| **Hachage**         | Argon2id                               | OWASP recommended, résistant aux GPU                  |
| **Logging**         | Pino (nestjs-pino)                     | JSON structuré, requestId automatique                 |
| **Validation**      | class-validator (API) / Zod (packages) | DTOs décorés + schémas partagés                       |
| **Documentation**   | Swagger/OpenAPI                        | Génération automatique depuis les DTOs                |
| **Monorepo**        | pnpm + Turborepo                       | Workspace protocol, build parallèle                   |
| **Tests**           | Jest                                   | Pyramide : unitaire > intégration > E2E               |

---

## Architecture des dossiers

```
taxikiwi/
├── apps/
│   └── api/                          ← API NestJS (ce document)
│       ├── src/
│       │   ├── common/
│       │   │   └── filters/
│       │   │       └── all-exceptions.filter.ts    ← Filtre d'erreur global (RFC 7807)
│       │   ├── modules/
│       │   │   ├── core/             ← Module 01 — Infrastructure
│       │   │   │   ├── config/       ← Configuration typée + validation Joi
│       │   │   │   ├── database/     ← TypeORM async config
│       │   │   │   ├── health/       ← /health + /ready endpoints
│       │   │   │   ├── redis/        ← Client IoRedis partagé
│       │   │   │   └── core.module.ts
│       │   │   ├── auth/             ← Module 02 — Authentification
│       │   │   │   ├── decorators/   ← @Public(), @Roles(), @CurrentUser()
│       │   │   │   ├── dto/          ← LoginDto, ChangePasswordDto
│       │   │   │   ├── entities/     ← RefreshToken entity
│       │   │   │   ├── guards/       ← JwtAuthGuard, JwtRefreshGuard, RolesGuard
│       │   │   │   ├── repositories/ ← RefreshTokenRepository
│       │   │   │   ├── strategies/   ← JwtStrategy, JwtRefreshStrategy
│       │   │   │   ├── types/        ← AuthenticatedUser, AccessTokenPayload
│       │   │   │   ├── __tests__/    ← Tests unitaires
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   └── auth.module.ts
│       │   │   ├── tenancy/          ← Module 03 — Isolation multi-tenant
│       │   │   │   ├── decorators/   ← @CurrentTenant()
│       │   │   │   ├── __tests__/    ← Tests unitaires
│       │   │   │   ├── tenant-context.ts     ← AsyncLocalStorage
│       │   │   │   ├── tenant-context.interceptor.ts ← Extraction JWT → contexte
│       │   │   │   ├── tenancy.service.ts    ← SET LOCAL pour RLS
│       │   │   │   └── tenancy.module.ts
│       │   │   ├── audit/            ← Module 04 — Journal d'audit immuable
│       │   │   │   ├── decorators/   ← @Auditable(action)
│       │   │   │   ├── entities/     ← AuditLog entity
│       │   │   │   ├── __tests__/    ← Tests unitaires
│       │   │   │   ├── audit.interceptor.ts  ← Capture automatique before/after
│       │   │   │   ├── audit.service.ts      ← Insert-only, sanitize
│       │   │   │   ├── audit.controller.ts   ← GET /admin/audit-logs (SUPER_ADMIN)
│       │   │   │   └── audit.module.ts
│       │   │   ├── groupements/      ← Module 05 — Groupements de taxis
│       │   │   │   ├── entities/     ← Groupement + GroupementSettings
│       │   │   │   ├── dto/          ← DTOs création, update, settings
│       │   │   │   ├── __tests__/    ← Tests unitaires du service
│       │   │   │   ├── groupements.controller.ts
│       │   │   │   ├── groupements.service.ts
│       │   │   │   └── groupements.module.ts
│       │   │   ├── users/            ← Module 06 — Utilisateurs backoffice
│       │   │   │   ├── entities/     ← User + UserInvitation
│       │   │   │   ├── dto/          ← DTOs listing, invitation, acceptation, update
│       │   │   │   ├── templates/    ← Emails Handlebars HTML + texte
│       │   │   │   ├── __tests__/    ← Service + processor email
│       │   │   │   ├── users.controller.ts
│       │   │   │   ├── users.service.ts
│       │   │   │   ├── users-mailer.service.ts
│       │   │   │   ├── users-email.processor.ts
│       │   │   │   └── users.module.ts
│       │   │   ├── drivers/          ← Module 07 — Chauffeurs
│       │   │   │   ├── entities/     ← Driver
│       │   │   │   ├── dto/          ← DTOs CRUD, listing, suspension
│       │   │   │   ├── types/        ← DriverStatus
│       │   │   │   ├── __tests__/    ← Tests unitaires du service
│       │   │   │   ├── drivers.controller.ts
│       │   │   │   ├── drivers.service.ts
│       │   │   │   └── drivers.module.ts
│       │   │   ├── clients/          ← Module 08 — Clients
│       │   │   │   ├── entities/     ← Client + ClientAddress
│       │   │   │   ├── dto/          ← DTOs CRUD, adresses, blacklist
│       │   │   │   ├── __tests__/    ← Tests unitaires du service
│       │   │   │   ├── clients.controller.ts
│       │   │   │   ├── clients.service.ts
│       │   │   │   └── clients.module.ts
│       │   │   └── courses/          ← Module 09 — Courses squelette
│       │   │       ├── entities/     ← Course
│       │   │       ├── dto/          ← DTOs CRUD, listing
│       │   │       ├── types/        ← CourseStatus
│       │   │       ├── __tests__/    ← Tests unitaires du service
│       │   │       ├── courses.controller.ts
│       │   │       ├── courses.service.ts
│       │   │       └── courses.module.ts
│       │   ├── migrations/
│       │   │   ├── 1714000001000-AuthTables.ts        ← refresh_tokens
│       │   │   ├── 1714000002000-RlsPolicies.ts       ← Fonction helper RLS
│       │   │   ├── 1714000003000-AuditPartitions.ts   ← audit_logs partitionnée
│       │   │   ├── 1714000004000-GroupementsTables.ts ← groupements + settings
│       │   │   ├── 1714000005000-UsersTables.ts       ← users + invitations + RLS
│       │   │   ├── 1714000006000-DriversTable.ts      ← drivers + RLS + transitions
│       │   │   ├── 1714000007000-ClientsTables.ts     ← clients + adresses + RLS
│       │   │   └── 1714000008000-CoursesTable.ts      ← courses squelette + RLS
│       │   ├── app.module.ts         ← Câblage global (guards, intercepteur)
│       │   └── main.ts              ← Bootstrap Fastify
│       └── test/                     ← Tests d'intégration
├── packages/
│   ├── shared-config/                ← Constantes métier (roles, permissions, erreurs)
│   ├── shared-types/                 ← Interfaces API/Backoffice (auth, error, pagination)
│   └── shared-validators/            ← Schémas Zod partagés (login, changePassword)
└── taxikiwi-wave1-guide.html         ← Document de référence architecturale
```

---

## Sprint 0 — Fondations (terminé ✅)

### Ce qui a été livré

Le Sprint 0 a posé l'infrastructure technique du monorepo :

| Élément             | Détail                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Monorepo**        | pnpm workspaces + Turborepo pour le build parallèle                                               |
| **API NestJS**      | Bootstrap Fastify avec Helmet, CORS, cookies, versioning URI `/api/v1/`                           |
| **Configuration**   | `configuration.ts` typée + `validation.schema.ts` Joi (refuse de démarrer si une variable manque) |
| **Base de données** | TypeORM async config avec pool min/max, SSL conditionnel, `synchronize: false`                    |
| **Redis**           | Client IoRedis partagé + BullMQ pour les jobs async                                               |
| **Health checks**   | `GET /health` (liveness) + `GET /ready` (readiness — vérifie PostgreSQL + Redis)                  |
| **Logging**         | Pino JSON structuré avec requestId automatique via AsyncLocalStorage                              |
| **Sécurité HTTP**   | Helmet (HSTS, X-Content-Type, X-Frame), rate limiting global 100 req/min                          |
| **Validation**      | ValidationPipe global avec whitelist + forbidNonWhitelisted                                       |
| **Erreurs**         | AllExceptionsFilter — format RFC 7807 avec `code`, `message`, `details`, `requestId`              |
| **Swagger**         | Documentation OpenAPI auto-générée, activable par variable d'environnement                        |
| **Outillage**       | ESLint strict + Prettier (printWidth 100, semi, singleQuote)                                      |

### Variables d'environnement requises

| Variable             | Obligatoire | Contrainte                                                    |
| -------------------- | :---------: | ------------------------------------------------------------- |
| `DATABASE_URL`       |     ✅      | Format `postgresql://...`                                     |
| `JWT_ACCESS_SECRET`  |     ✅      | ≥ 32 caractères                                               |
| `JWT_REFRESH_SECRET` |     ✅      | ≥ 32 caractères                                               |
| `COOKIE_SECRET`      |     ✅      | ≥ 32 caractères                                               |
| `REDIS_URL`          |     ✅      | Format `redis://...`                                          |
| `NODE_ENV`           |     ❌      | `development` / `test` / `production` (défaut: `development`) |
| `PORT`               |     ❌      | Défaut: 3000                                                  |
| `LOG_LEVEL`          |     ❌      | Défaut: `info`                                                |

---

## Sprint 1 — Modules Core, Auth, Tenancy, Audit (terminé ✅)

### Module 01 · Core

**Couche** : Fondations — **Dépendances** : aucune

Le module Core est la racine du graphe de dépendances. Il fournit :

- **Configuration typée** : toutes les valeurs d'environnement validées et accessibles via `ConfigService`
- **Connexion PostgreSQL** : TypeORM configuré async avec pool optimisé (`poolMin: 2`, `poolMax: 10`)
- **Client Redis** : IoRedis partagé pour le cache et les files BullMQ
- **Health checks** : `/health` (liveness) et `/ready` (readiness PostgreSQL + Redis)

Les endpoints `/health` et `/ready` sont marqués `@Public()` — ils ne passent pas par le JwtAuthGuard.

### Module 02 · Auth

**Couche** : Fondations — **Dépendances** : Core

Le module Auth gère l'authentification et les sessions du backoffice.

#### Endpoints

| Méthode | Route                          | Description                            | Protection                       |
| ------- | ------------------------------ | -------------------------------------- | -------------------------------- |
| `POST`  | `/api/v1/auth/login`           | Connexion email/password               | `@Public()` + rate limit 5/15min |
| `POST`  | `/api/v1/auth/refresh`         | Rotation du refresh token              | Cookie HttpOnly                  |
| `POST`  | `/api/v1/auth/logout`          | Déconnexion (révoque le refresh token) | JWT                              |
| `POST`  | `/api/v1/auth/change-password` | Changement de mot de passe             | JWT                              |

#### Sécurité

| Mesure                      | Implémentation                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Hachage**                 | Argon2id (memoryCost: 19456, timeCost: 2, parallelism: 1) — OWASP compliant          |
| **Anti-énumération**        | Hash dummy si email inexistant (temps constant ± 10ms)                               |
| **Tokens**                  | Access JWT (body, 15min) + Refresh JWT (cookie HttpOnly Secure SameSite=Strict, 90j) |
| **Rotation**                | Chaque refresh émet un nouveau couple et révoque l'ancien                            |
| **Détection réutilisation** | Si un refresh déjà renouvelé est réutilisé → toute la famille invalidée              |
| **Rate limiting**           | 5 tentatives login / 15 minutes / IP                                                 |
| **Change password**         | Révoque TOUTES les sessions de l'utilisateur                                         |

#### Guards et décorateurs exportés

```typescript
// Protège toute route par défaut (enregistré globalement)
JwtAuthGuard

// Vérifie les rôles de l'utilisateur
@Roles(UserRole.ADMIN)
RolesGuard  // → ForbiddenException explicite si rôles insuffisants

// Désactive le JwtAuthGuard sur une route
@Public()

// Injecte l'utilisateur courant dans le controller
@CurrentUser() user: AuthenticatedUser
```

### Module 03 · Tenancy

**Couche** : Fondations — **Dépendances** : Core (indirect via DataSource)

Le module Tenancy garantit l'isolation des données entre groupements.
C'est le mécanisme de sécurité le plus critique du projet.

#### Défense en profondeur (3 couches)

```
┌─────────────────────────────────────────────┐
│  Couche 1 — AsyncLocalStorage               │
│  TenantContextInterceptor extrait groupementId│
│  du JWT et le stocke dans TenantContext      │
├─────────────────────────────────────────────┤
│  Couche 2 — Filtre applicatif               │
│  Les services ajoutent WHERE groupement_id   │
│  = ? dans chaque requête                     │
├─────────────────────────────────────────────┤
│  Couche 3 — PostgreSQL RLS                  │
│  SET LOCAL app.current_groupement_id = $1    │
│  → La base refuse les lignes d'un autre     │
│    tenant même si le WHERE est oublié        │
└─────────────────────────────────────────────┘
```

#### Fichiers clés

| Fichier                         | Rôle                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `tenant-context.ts`             | `AsyncLocalStorage<TenantData>` — `get()`, `getOrNull()`, `run()`        |
| `tenant-context.interceptor.ts` | Lit `request.user.groupementId` après `JwtAuthGuard` → ouvre le contexte |
| `tenancy.service.ts`            | `setTenantOnQueryRunner()` → `SET LOCAL` pour RLS                        |
| `@CurrentTenant()`              | Décorateur de paramètre pour injecter le groupementId                    |

### Module 04 · Audit

**Couche** : Fondations — **Dépendances** : Core (TypeORM), Tenancy (contexte)

Le module Audit enregistre de manière **immuable** toutes les actions sensibles.

#### Principes

- **Append-only** : le service n'expose que `log()` et `findAll()`, jamais `update` ni `delete`
- **Immuabilité PostgreSQL** : droits UPDATE/DELETE révoqués pour le rôle applicatif
- **Sanitization** : les champs sensibles (`passwordHash`, `tokenHash`, `secret`, `cookie`) sont automatiquement remplacés par `[REDACTED]`
- **Non-bloquant** : une erreur d'écriture audit est logguée mais ne propage JAMAIS au flux métier

#### Fonctionnement automatique

```typescript
// Dans un controller métier — le décorateur suffit
@Post()
@Roles(UserRole.ADMIN)
@Auditable('DRIVER_CREATED')    // ← L'intercepteur global capture tout
async create(
  @Body() dto: CreateDriverDto,
  @CurrentTenant() groupementId: string,
) {
  return this.driversService.create(dto, groupementId);
}
```

L'`AuditInterceptor` (enregistré globalement via `APP_INTERCEPTOR`) :

1. Détecte `@Auditable(action)` sur la méthode
2. Capture le contexte (userId, groupementId, IP, User-Agent, requestId)
3. Exécute le handler
4. Si succès → écrit dans `audit_logs` avec les valeurs `after`

#### Endpoint d'inspection

| Méthode | Route                      | Protection               |
| ------- | -------------------------- | ------------------------ |
| `GET`   | `/api/v1/admin/audit-logs` | `SUPER_ADMIN` uniquement |

Supporte : pagination, filtrage par action, utilisateur, groupement, période.

#### Table `audit_logs`

```
audit_logs (PARTITIONED BY RANGE created_at)
├── id              uuid PK
├── groupement_id   uuid (nullable — actions SUPER_ADMIN hors tenant)
├── user_id         uuid NOT NULL
├── action          varchar(64) — code standardisé (DRIVER_CREATED, USER_UPDATED, etc.)
├── resource_type   varchar(64) — ex: 'Driver', 'User'
├── resource_id     uuid
├── before          jsonb — état avant modification (null pour créations)
├── after           jsonb — état après modification (null pour suppressions)
├── ip_address      inet
├── user_agent      varchar(512)
├── request_id      varchar(64) — lien vers les logs pino
└── created_at      timestamptz
```

Partitionnée par mois — 6 partitions pré-créées. RLS activée.

---

## Packages partagés

Les packages dans `packages/` sont la **source de vérité** pour les constantes, types et validations
partagés entre l'API et le futur backoffice Next.js.

> **Note technique** : L'API utilise `moduleResolution: "nodenext"` qui ne résout pas les exports
> `.ts` source des packages. Les constantes critiques (UserRole, error codes) sont donc dupliquées
> localement dans l'API avec un commentaire référençant la source de vérité. Le backoffice (qui
> utilise `moduleResolution: "bundler"`) importera directement depuis les packages.

### `@taxikiwi/shared-config`

| Fichier            | Contenu                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `roles.ts`         | `UserRole` enum, `ALL_ROLES`, `ROLE_HIERARCHY`                           |
| `permissions.ts`   | `Permission` enum, `ROLE_PERMISSIONS` matrice, `hasPermission()`         |
| `errors.ts`        | 15 codes d'erreur stables, `ERROR_CODES_BY_STATUS` mapping               |
| `audit-actions.ts` | `AuditAction` enum (Auth, Groupements, Users, Drivers, Clients, Courses) |

### `@taxikiwi/shared-types`

| Fichier         | Contenu                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `auth.ts`       | `AuthTokenResponse`, `AuthUserResponse`, `LoginPayload`, `ChangePasswordPayload` |
| `error.ts`      | `ApiErrorResponse`, `ApiErrorDetail` (format RFC 7807)                           |
| `pagination.ts` | `PaginatedResponse<T>`, `PaginationMeta`, `PaginationQuery`                      |

### `@taxikiwi/shared-validators`

| Fichier           | Contenu                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| `auth.schemas.ts` | `loginSchema`, `changePasswordSchema` (Zod) — mêmes règles API et backoffice |

---

## Migrations

Les migrations sont la **seule source de vérité** du schéma de base de données.
`synchronize: false` est imposé — jamais de synchronisation automatique.

| Migration                         | Contenu                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `1714000001000-AuthTables`        | Table `refresh_tokens` (hash, family_id, revoked_at, expires_at) |
| `1714000002000-RlsPolicies`       | Fonction `app_current_groupement_id()` pour RLS                  |
| `1714000003000-AuditPartitions`   | Table `audit_logs` partitionnée par mois + RLS + indexes         |
| `1714000004000-GroupementsTables` | Tables `groupements` et `groupement_settings` sans RLS           |
| `1714000005000-UsersTables`       | Tables `users`, `user_invitations`, RLS, FK `refresh_tokens`     |
| `1714000006000-DriversTable`      | Table `drivers`, contraintes métier, unicité matricule, RLS      |
| `1714000007000-ClientsTables`     | Tables `clients`, `client_addresses`, index téléphone, RLS       |
| `1714000008000-CoursesTable`      | Table `courses` squelette, index période/chauffeur/client, RLS   |

**Exécution actuelle** :

```bash
pnpm --filter api exec typeorm-ts-node-commonjs migration:run -d src/modules/core/database/data-source.ts
```

> À faire avant industrialisation : ajouter des scripts `migration:run` et `migration:generate`
> dans `apps/api/package.json` pour éviter de répéter la commande TypeORM complète.

---

## Flux de requête HTTP

```
Requête HTTP entrante
    │
    ▼
┌─ Fastify ─────────────────────────────────────────┐
│  Helmet (headers sécurité)                         │
│  CORS (origin: ADMIN_ORIGIN, credentials: true)    │
│  Cookie parser                                     │
└────────────────────────────────────────────────────┘
    │
    ▼
┌─ NestJS Pipeline ─────────────────────────────────┐
│  1. ThrottlerGuard      (rate limiting global)     │
│  2. JwtAuthGuard        (vérifie access token)     │
│  3. RolesGuard          (vérifie rôles requis)     │
│  4. TenantContextInterceptor (contexte AsyncLocalStorage)│
│  5. ValidationPipe      (valide DTOs)              │
│  6. Controller          (logique de route)          │
│  7. AuditInterceptor    (capture after si succès)  │
│                                                     │
│  En cas d'erreur à n'importe quelle étape :        │
│  → AllExceptionsFilter  (format RFC 7807)          │
└────────────────────────────────────────────────────┘
    │
    ▼
Réponse JSON
```

---

## Sécurité

### Résumé des protections en place

| Vecteur d'attaque    | Protection                                           | Module  |
| -------------------- | ---------------------------------------------------- | ------- |
| Brute force login    | Rate limiting 5/15min + Argon2id lent                | Auth    |
| Énumération emails   | Temps constant (hash dummy)                          | Auth    |
| Vol de refresh token | Cookie HttpOnly + rotation + détection réutilisation | Auth    |
| XSS via headers      | Helmet (HSTS, X-Content-Type, X-Frame)               | Core    |
| CSRF                 | SameSite=Strict sur cookies                          | Auth    |
| Fuite inter-tenant   | AsyncLocalStorage + WHERE explicite + PostgreSQL RLS | Tenancy |
| Injection SQL        | Requêtes paramétrées TypeORM                         | Core    |
| Payloads invalides   | class-validator + whitelist strict                   | Core    |
| Secrets dans logs    | Sanitization automatique (passwordHash → [REDACTED]) | Audit   |

---

## Sprint 2 — Modules métier (Couche 2 — Acteurs)

Le Sprint 2 implémente les modules métier construits sur les fondations du Sprint 1.

### Module 05 · Groupements ✅ COMPLET

Table maîtresse des groupements de taxis. Point d'ancrage de toute la donnée métier :
Users, Drivers, Clients et Courses pointent tous vers un Groupement.

**Architecture spécifique :**

- Pas de RLS sur la table `groupements` (le groupement EST le tenant, pas une donnée filtrée)
- Toutes les opérations réservées au `SUPER_ADMIN`
- Commenté explicitement dans le code source

**Structure :**

```
src/modules/groupements/
├── entities/
│   ├── groupement.entity.ts          # Fiche opérationnelle (nom, code, adresse, contact)
│   └── groupement-settings.entity.ts # Config métier (dispatch, horaires, RGPD, branding)
├── dto/
│   ├── create-groupement.dto.ts      # Création + premier admin invité
│   ├── update-groupement.dto.ts      # Mise à jour partielle
│   └── update-groupement-settings.dto.ts # Paramètres métier dédiés
├── groupements.controller.ts         # 6 endpoints REST
├── groupements.service.ts            # Unicité nom/code, settings, audit
├── groupements.module.ts
└── __tests__/
    └── groupements.service.spec.ts   # tests unitaires du service
```

**Endpoints :**

| Méthode  | Route                              | Description                             |
| -------- | ---------------------------------- | --------------------------------------- |
| `GET`    | `/api/v1/groupements`              | Liste paginée + filtre statut/recherche |
| `GET`    | `/api/v1/groupements/:id`          | Détail avec settings                    |
| `POST`   | `/api/v1/groupements`              | Création groupement + invitation admin  |
| `PATCH`  | `/api/v1/groupements/:id`          | Mise à jour partielle                   |
| `PATCH`  | `/api/v1/groupements/:id/settings` | Mise à jour paramètres métier           |
| `DELETE` | `/api/v1/groupements/:id`          | Soft delete (isActive = false)          |

**Modèle de données :**

- `groupements` — nom commercial (unique), code public (unique), adresse, contact, zone de service, `is_active`
- `groupement_settings` — one-to-one, `ring_timeout_seconds` (défaut 30), `dispatch_policy` (STATION_FIRST / FREE_FIRST / DISTANCE_FIRST), `service_hours` (JSONB 7j/7), `gdpr_notice`, `logo_url`, `primary_color`

**Migrations :** `1714000004000-GroupementsTables.ts`, puis correction
`1714000011000-RemoveGroupementLegalFields.ts` pour retirer `legal_name` et `siret` des bases
déjà créées.

---

### Module 06 · Users ✅ COMPLET

Comptes utilisateurs du backoffice, rattachés au groupement courant. Les clients finaux ne sont
pas représentés ici.

**Architecture spécifique :**

- Tables tenant-scoped avec RLS (`users`, `user_invitations`)
- Tokens d'invitation et de reset stockés uniquement sous forme SHA-256
- Envoi d'emails asynchrone via BullMQ + Nodemailer + Mailpit en local
- Templates Handlebars copiés dans `dist` via `nest-cli.json`
- Désactivation utilisateur = soft delete (`is_active = false`) + révocation des refresh tokens

**Structure :**

```
src/modules/users/
├── entities/
│   ├── user.entity.ts              # Profil backoffice + roles + password_hash
│   └── user-invitation.entity.ts   # Invitations + reset password one-shot
├── dto/
│   ├── list-users-query.dto.ts
│   ├── create-user-invitation.dto.ts
│   ├── accept-user-invitation.dto.ts
│   ├── reset-password.dto.ts
│   ├── update-user.dto.ts
│   ├── user-response.dto.ts
│   └── user-invitation-response.dto.ts
├── templates/
│   ├── invitation.html.hbs
│   ├── invitation.text.hbs
│   ├── reset-password.html.hbs
│   └── reset-password.text.hbs
├── users.controller.ts             # Endpoints REST v1
├── users.service.ts                # CRUD tenant + invitations + reset
├── users-mailer.service.ts         # Rendu Handlebars + SMTP
├── users-email.processor.ts        # Jobs BullMQ
├── users.module.ts
└── __tests__/
    ├── users.service.spec.ts
    └── users-email.processor.spec.ts
```

**Endpoints :**

| Méthode  | Route                                        | Description                                  | Protection             |
| -------- | -------------------------------------------- | -------------------------------------------- | ---------------------- |
| `GET`    | `/api/v1/users`                              | Liste paginée + filtres rôle/statut/search   | `ADMIN`                |
| `GET`    | `/api/v1/users/:id`                          | Détail utilisateur du groupement courant     | `ADMIN`                |
| `POST`   | `/api/v1/users/invitations`                  | Crée une invitation email (72h)              | `ADMIN`                |
| `POST`   | `/api/v1/users/invitations/:token/accept`    | Accepte une invitation et crée le compte     | `@Public()` + throttle |
| `PATCH`  | `/api/v1/users/:id`                          | Modifie prénom, nom, téléphone, rôles        | `ADMIN`                |
| `DELETE` | `/api/v1/users/:id`                          | Désactive et révoque les sessions            | `ADMIN`                |
| `POST`   | `/api/v1/users/:id/reset-password`           | Envoie un lien de reset password (1h)        | `ADMIN`                |
| `POST`   | `/api/v1/users/reset-password/:token/accept` | Finalise le reset password et révoque tokens | `@Public()` + throttle |

**Migration :** `1714000005000-UsersTables.ts`

**Tests :** invitation + acceptation, token expiré, token déjà utilisé, reset password, révocation
sessions, processor BullMQ.

---

### Module 07 · Drivers ✅ COMPLET

Chauffeurs rattachés à un groupement, avec statut métier et structure prête pour le futur compte
mobile.

**Architecture spécifique :**

- Table tenant-scoped avec RLS (`drivers`)
- Matricule unique par groupement (`groupement_id`, `matricule`)
- Matricule validé en DTO et en `CHECK` PostgreSQL : `XX-9999` à `XX-999999`
- Téléphone normalisé en E.164 via `src/common/utils/phone.util.ts`
- `user_id` nullable et unique pour le futur lien compte mobile
- `PATCH` ne modifie jamais le statut : transitions dédiées `suspend`, `reactivate`, `DELETE`
- `OFFBOARDED` est une transition finale côté API

**Structure :**

```
src/modules/drivers/
├── entities/
│   └── driver.entity.ts
├── dto/
│   ├── create-driver.dto.ts
│   ├── update-driver.dto.ts
│   ├── list-drivers-query.dto.ts
│   ├── suspend-driver.dto.ts
│   └── driver-response.dto.ts
├── types/
│   └── driver-status.enum.ts
├── drivers.controller.ts
├── drivers.service.ts
├── drivers.module.ts
└── __tests__/
    └── drivers.service.spec.ts
```

**Endpoints :**

| Méthode  | Route                            | Description                              | Protection |
| -------- | -------------------------------- | ---------------------------------------- | ---------- |
| `GET`    | `/api/v1/drivers`                | Liste paginée + filtres statut/search    | `ADMIN`    |
| `GET`    | `/api/v1/drivers/:id`            | Détail chauffeur du groupement courant   | `ADMIN`    |
| `POST`   | `/api/v1/drivers`                | Crée un chauffeur                        | `ADMIN`    |
| `PATCH`  | `/api/v1/drivers/:id`            | Modifie les champs hors statut           | `ADMIN`    |
| `POST`   | `/api/v1/drivers/:id/suspend`    | Suspend un chauffeur actif               | `ADMIN`    |
| `POST`   | `/api/v1/drivers/:id/reactivate` | Réactive un chauffeur suspendu           | `ADMIN`    |
| `DELETE` | `/api/v1/drivers/:id`            | Passe le chauffeur en `OFFBOARDED` final | `ADMIN`    |

**Migration :** `1714000006000-DriversTable.ts`

**Tests :** unicité matricule par groupement, normalisation E.164, warning audit sur téléphone
dupliqué, suspension/réactivation, irréversibilité `OFFBOARDED`, isolation tenant dans le listing.

---

### Module 08 · Clients ✅ COMPLET

Fiches clients des groupements, avec téléphone E.164 comme clé de recherche, adresses multiples et
liste noire.

**Architecture spécifique :**

- Tables tenant-scoped avec RLS (`clients`, `client_addresses`)
- Téléphone normalisé via `phone.util.ts` et indexé en B-tree
- Unicité du téléphone par groupement avec erreur 409 contenant `existingClientId`
- `ClientAddress` en one-to-many avec une seule adresse par défaut par client
- `DELETE` archive via `archived_at`, ne supprime pas physiquement
- Modification d'une fiche archivée refusée avec `410 Gone`
- `unarchive` explicitement disponible comme seule action autorisée pour revenir d'une archive
- Blacklist/unblacklist audités explicitement avec before/after et motif
- `anonymization_requested_at` présent pour le futur workflow RGPD Vague 4

**Structure :**

```
src/modules/clients/
├── entities/
│   ├── client.entity.ts
│   └── client-address.entity.ts
├── dto/
│   ├── create-client.dto.ts
│   ├── update-client.dto.ts
│   ├── list-clients-query.dto.ts
│   ├── search-client-query.dto.ts
│   ├── blacklist-client.dto.ts
│   ├── client-address.dto.ts
│   └── client-response.dto.ts
├── clients.controller.ts
├── clients.service.ts
├── clients.module.ts
└── __tests__/
    └── clients.service.spec.ts
```

**Endpoints :**

| Méthode  | Route                                      | Description                              | Protection |
| -------- | ------------------------------------------ | ---------------------------------------- | ---------- |
| `GET`    | `/api/v1/clients`                          | Liste paginée + filtres nom/téléphone    | `ADMIN`    |
| `GET`    | `/api/v1/clients/search?phone=...`         | Recherche exacte par téléphone normalisé | `ADMIN`    |
| `GET`    | `/api/v1/clients/:id`                      | Détail client avec adresses              | `ADMIN`    |
| `POST`   | `/api/v1/clients`                          | Crée une fiche client                    | `ADMIN`    |
| `PATCH`  | `/api/v1/clients/:id`                      | Modifie une fiche active                 | `ADMIN`    |
| `DELETE` | `/api/v1/clients/:id`                      | Archive la fiche                         | `ADMIN`    |
| `POST`   | `/api/v1/clients/:id/unarchive`            | Désarchive la fiche                      | `ADMIN`    |
| `POST`   | `/api/v1/clients/:id/blacklist`            | Blacklist avec motif obligatoire         | `ADMIN`    |
| `POST`   | `/api/v1/clients/:id/unblacklist`          | Retire de la blacklist                   | `ADMIN`    |
| `POST`   | `/api/v1/clients/:id/addresses`            | Ajoute une adresse                       | `ADMIN`    |
| `PATCH`  | `/api/v1/clients/:id/addresses/:addressId` | Modifie une adresse                      | `ADMIN`    |
| `DELETE` | `/api/v1/clients/:id/addresses/:addressId` | Supprime une adresse                     | `ADMIN`    |

**Migration :** `1714000007000-ClientsTables.ts`

**Tests :** recherche téléphone multi-formats, conflit téléphone avec `existingClientId`, motif
blacklist obligatoire, blacklist/unblacklist audités, refus de modification après archive, adresse
par défaut, isolation tenant dans le listing.

---

### Module 09 · Courses (squelette) ✅ COMPLET

Saisie manuelle de courses pour la Vague 1 : pas de lien vers un appel source, pas de GPS,
pas de WebSocket et pas de module paiement. Le champ `amountEur` reste optionnel pour historiser
un montant indicatif, mais aucun `payment_method` et aucun workflow de paiement ne sont modélisés.

**Structure livrée :**

```text
src/modules/courses/
├── entities/course.entity.ts
├── dto/
│   ├── create-course.dto.ts
│   ├── update-course.dto.ts
│   ├── list-courses-query.dto.ts
│   └── course-response.dto.ts
├── types/course-status.enum.ts
├── __tests__/courses.service.spec.ts
├── courses.constants.ts
├── courses.controller.ts
├── courses.service.ts
└── courses.module.ts
```

**Modèle Vague 1 :**

- `groupement_id` obligatoire, protégé par RLS
- `driver_id` obligatoire, validé dans le groupement courant
- `client_id` nullable, validé si fourni
- `pickup_address`, `dropoff_address`, `started_at`, `duration_minutes`, `distance_km`
- `amount_eur` nullable, strictement indicatif
- statuts : `COMPLETED`, `CANCELLED`, `NO_SHOW`
- vrai `DELETE` SQL pour retirer une saisie manuelle erronée

**Endpoints :**

| Méthode  | Route                 | Rôle    |
| -------- | --------------------- | ------- |
| `GET`    | `/api/v1/courses`     | `ADMIN` |
| `GET`    | `/api/v1/courses/:id` | `ADMIN` |
| `POST`   | `/api/v1/courses`     | `ADMIN` |
| `PATCH`  | `/api/v1/courses/:id` | `ADMIN` |
| `DELETE` | `/api/v1/courses/:id` | `ADMIN` |

**Migration :** `1714000008000-CoursesTable.ts`

**Tests :** validation chauffeur/client dans le tenant, création sans client, listing filtré par
période, audit création/modification/suppression, isolation tenant via `groupement_id`.

---

### Prochaines étapes

- La migration `1714000008000-CoursesTable` est appliquée localement
- Brancher le futur backoffice `/courses` sur ces endpoints

---

## Commandes utiles

```bash
# Installer les dépendances
pnpm install

# Vérifier le typage
pnpm --filter api build

# Lancer les tests
pnpm --filter api test

# Lancer les tests avec couverture
pnpm --filter api test --coverage

# Lancer les migrations
pnpm --filter api exec typeorm-ts-node-commonjs migration:run -d src/modules/core/database/data-source.ts

# Générer une nouvelle migration
pnpm --filter api exec typeorm-ts-node-commonjs migration:generate src/migrations/NomDeLaMigration -d src/modules/core/database/data-source.ts

# Démarrer l'API en développement
pnpm --filter api start:dev

# Démarrer PostgreSQL + Redis (Docker)
docker compose --env-file .env -f docker/docker-compose.yml up -d
```
