# 🥝 TaxiKiwi

> Plateforme SaaS multi-tenant de gestion de groupements de taxis.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10.31-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Propriétaire-red)](#licence)

---

## 📖 À propos

**TaxiKiwi** est une solution complète pour la gestion de groupements de taxis. La plateforme permet de gérer les chauffeurs, les clients, les courses et les opérations quotidiennes d'un ou plusieurs groupements, avec une isolation stricte des données par tenant.

### Fonctionnalités principales

- 🏢 **Multi-tenant** — Chaque groupement de taxis est un tenant isolé, avec ses propres données protégées par PostgreSQL RLS
- 🔐 **Authentification sécurisée** — JWT Access Token + Refresh Token HttpOnly, hash Argon2id, rotation automatique des tokens
- 👥 **Gestion des rôles** — Super Admin (plateforme), Admin (groupement), Driver (mobile)
- 🚕 **Gestion des chauffeurs** — Invitation par email, identifiant unique par groupement, suivi de statut
- 📋 **Gestion des courses** — Saisie, suivi et historique des courses
- 👤 **Gestion des clients** — Carnet d'adresses, historique des courses
- 📊 **Audit** — Journalisation des actions sensibles
- 📧 **Notifications email** — Templates Handlebars + file BullMQ asynchrone
- 📄 **Documentation API** — Swagger auto-généré

---

## 🏗️ Architecture

Ce projet est un **monorepo** géré avec [pnpm workspaces](https://pnpm.io/workspaces) et [Turborepo](https://turbo.build/).

```
taxikiwi/
├── apps/
│   ├── api/                 # API Backend — NestJS + Fastify
│   ├── backoffice/          # Backoffice Groupement — Next.js 16
│   └── admin/               # Backoffice Plateforme (à venir)
├── packages/
│   ├── shared-types/        # Types TypeScript partagés API ↔ Frontend
│   ├── shared-validators/   # Schémas de validation Zod partagés
│   └── shared-config/       # Configuration partagée (rôles, permissions)
├── docker/
│   ├── docker-compose.yml   # Services d'infrastructure locale
│   └── postgres/             # Scripts d'init PostgreSQL
├── documentation/           # Guides fonctionnels (backend & frontend)
└── turbo.json               # Configuration Turborepo
```

### Stack technique

| Couche                 | Technologie                                              |
| ---------------------- | -------------------------------------------------------- |
| **API**                | NestJS 11, Fastify, TypeORM, Passport JWT                |
| **Backoffice**         | Next.js 16, React 19, NextAuth, TailwindCSS 4, shadcn/ui |
| **Base de données**    | PostgreSQL 16 + PostGIS                                  |
| **Cache / Queues**     | Redis 7, BullMQ                                          |
| **Emails (dev)**       | Mailpit (capture SMTP locale)                            |
| **Hash mots de passe** | Argon2id                                                 |
| **Validation**         | class-validator (API), Zod (frontend)                    |
| **Logs**               | nestjs-pino                                              |
| **Monorepo**           | pnpm 10, Turborepo                                       |
| **Qualité de code**    | ESLint, Prettier, Husky, lint-staged, Commitlint         |

---

## 🚀 Démarrage rapide

### Prérequis

- [Node.js](https://nodejs.org/) `>= 24.13.0`
- [pnpm](https://pnpm.io/) `>= 10.31.0`
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Cloner le dépôt

```bash
git clone git@github.com:taxikiwi/taxikiwi.git
cd taxikiwi
```

### 2. Configurer l'environnement

```bash
# PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

> [!IMPORTANT]
> Les valeurs dans `.env.example` sont des **valeurs de développement uniquement**. Ne jamais utiliser ces secrets en production.

### 3. Démarrer l'infrastructure Docker

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

Cela démarre les services suivants :

| Service                  | Port                         | Description                       |
| ------------------------ | ---------------------------- | --------------------------------- |
| **PostgreSQL** + PostGIS | `5432`                       | Base de données principale        |
| **Redis**                | `6379`                       | Cache et file BullMQ              |
| **Mailpit**              | `8025` (web) / `1025` (SMTP) | Capture d'emails en développement |
| **Adminer**              | `8080`                       | Interface d'administration BDD    |

### 4. Installer les dépendances

```bash
pnpm install
```

### 5. Exécuter les migrations

```bash
pnpm api:migration:run
```

### 6. Lancer le développement

```bash
# Lancer tous les services en parallèle
pnpm dev

# Ou lancer individuellement
pnpm --filter api start:dev       # API sur http://localhost:3000
pnpm --filter backoffice dev      # Backoffice sur http://localhost:3001
```

### 7. Accéder aux outils

| Outil       | URL                                                              |
| ----------- | ---------------------------------------------------------------- |
| API Swagger | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) |
| Backoffice  | [http://localhost:3001](http://localhost:3001)                   |
| Mailpit     | [http://localhost:8025](http://localhost:8025)                   |
| Adminer     | [http://localhost:8080](http://localhost:8080)                   |

---

## 📜 Scripts disponibles

### Monorepo (racine)

| Commande         | Description                                   |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Lance tous les services en mode développement |
| `pnpm build`     | Build de production de tous les packages      |
| `pnpm lint`      | Lint de tous les packages                     |
| `pnpm test`      | Exécute tous les tests                        |
| `pnpm typecheck` | Vérification des types TypeScript             |
| `pnpm format`    | Formatage du code avec Prettier               |

### Migrations (API)

| Commande                                                     | Description                    |
| ------------------------------------------------------------ | ------------------------------ |
| `pnpm api:migration:run`                                     | Exécuter les migrations        |
| `pnpm api:migration:generate -- src/migrations/NomMigration` | Générer une migration          |
| `pnpm api:migration:revert`                                  | Annuler la dernière migration  |
| `pnpm api:migration:show`                                    | Afficher l'état des migrations |

---

## 🔑 Authentification

Le système gère **deux flux d'authentification** distincts :

### Login Plateforme (Super Admin)

```http
POST /api/v1/auth/platform/login
Content-Type: application/json

{
  "email": "superadmin@taxikiwi.local",
  "password": "..."
}
```

### Login Groupement (Admin / Chauffeur)

```http
POST /api/v1/auth/groupement/login
Content-Type: application/json

{
  "groupementCode": "taxi-kiwi-sevres",
  "identifier": "T1",
  "password": "..."
}
```

### Sécurité

- **Access Token** : JWT Bearer, TTL 15 min
- **Refresh Token** : JWT en cookie HttpOnly, TTL 90 jours
- **Rotation automatique** des refresh tokens avec détection de vol
- **Rate limiting** global configurable
- **Argon2id** pour le hash des mots de passe

---

## 🧪 Tests

```bash
# Exécuter tous les tests
pnpm test

# Tests avec couverture
pnpm --filter api test:cov

# Tests en mode watch
pnpm --filter api test:watch
```

---

## 📐 Conventions

### Git

- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/) appliqués via Commitlint
- **Hooks** : Husky + lint-staged pour le formatage automatique avant chaque commit

Exemples de commits valides :

```
feat(api): ajout du module d'invitation chauffeur
fix(backoffice): correction de l'affichage du groupement actif
chore(deps): mise à jour de NestJS vers 11.1.19
```

### Code

- **TypeScript strict** sur tous les packages
- **ESLint** + **Prettier** pour la cohérence du code
- **Imports triés** et formatés automatiquement

---

## 📁 Variables d'environnement

Consultez le fichier [`.env.example`](.env.example) pour la liste complète des variables.

Les principales catégories sont :

| Catégorie   | Variables clés                                              |
| ----------- | ----------------------------------------------------------- |
| Application | `NODE_ENV`, `PORT`, `API_PORT`, `ADMIN_PORT`                |
| Sécurité    | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` |
| PostgreSQL  | `POSTGRES_HOST`, `POSTGRES_DB`, `DATABASE_URL`              |
| Redis       | `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`                     |
| Email       | `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM_ADDRESS`               |

---

## 🗂️ Documentation

La documentation fonctionnelle détaillée est disponible dans le dossier [`documentation/`](./documentation/) :

- [`backend-functional-guide.md`](./documentation/backend-functional-guide.md) — Guide fonctionnel complet du backend
- [`frontend-functional-guide.md`](./documentation/frontend-functional-guide.md) — Guide fonctionnel du frontend

---

## 👥 Équipe

Projet développé par l'équipe **TaxiKiwi**.

## 📄 Licence

Ce projet est sous licence **propriétaire**. Tous droits réservés.
"# taxi" 
