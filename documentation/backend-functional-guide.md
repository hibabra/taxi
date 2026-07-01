# TaxiKiwi Backend - Guide fonctionnel complet

> Derniere mise a jour : 3 mai 2026  
> Objectif : comprendre le backend actuel et la cible metier avant de faire des modifications.

Ce document explique le projet TaxiKiwi cote backend avec une lecture metier et technique :
quels modules existent, ce que chaque module fait, quels roles existent, comment les utilisateurs
sont crees, comment ils se connectent, et quels sont les cas d'usage principaux.

Le document de reference technique reste [apps/api/ARCHITECTURE.md](../apps/api/ARCHITECTURE.md).
Celui-ci est volontairement plus "terrain" : il explique le vrai comportement actuel du code.

---

## 1. Idee generale du projet

TaxiKiwi est une plateforme SaaS multi-tenant pour gerer des groupements de taxis.

Le mot important est **multi-tenant** :

- un **groupement** = une compagnie / organisation de taxis ;
- chaque groupement a ses propres users, chauffeurs, clients et courses ;
- un user d'un groupement ne doit jamais voir les donnees d'un autre groupement ;
- PostgreSQL RLS protege cette separation au niveau base de donnees.

Dans la Vague 1, le backend gere surtout :

- l'infrastructure API ;
- l'authentification backoffice ;
- les roles et permissions par route ;
- les groupements ;
- les utilisateurs backoffice ;
- les chauffeurs ;
- les clients ;
- les courses saisies manuellement ;
- l'audit des actions sensibles.

Important : aujourd'hui, les `users` sont des **utilisateurs backoffice**. Les clients finaux
ne sont pas des users. Les chauffeurs sont dans la table `drivers`; ils peuvent eventuellement
etre lies a un user plus tard via `driver.userId`, mais ce lien reste optionnel.

Decision metier du 3 mai 2026 : cette modelisation doit evoluer. Dans la cible, un chauffeur
doit avoir son propre compte mobile, l'admin du groupement est lui aussi un chauffeur, et seul
l'admin du groupement doit acceder au backoffice du groupement.

---

## 2. Vue rapide des acteurs

| Acteur              | Table/module  | Description                                                    |
| ------------------- | ------------- | -------------------------------------------------------------- |
| Plateforme TaxiKiwi | `SUPER_ADMIN` | Gere tous les groupements et peut voir l'audit global.         |
| Groupement de taxis | `groupements` | Tenant principal. Toutes les donnees metier pointent vers lui. |
| User backoffice     | `users`       | Personne qui utilise l'admin/backoffice.                       |
| Chauffeur           | `drivers`     | Chauffeur du groupement, avec vehicule et statut.              |
| Client final        | `clients`     | Personne qui appelle ou reserve une course.                    |
| Course              | `courses`     | Saisie manuelle Vague 1, sans paiement ni GPS.                 |

---

## 2.1 Cible metier a appliquer

Cette section decrit la cible demandee. Elle ne correspond pas encore entierement au code actuel.

### Super admin

Le `SUPER_ADMIN` reste le role plateforme.

Il doit pouvoir :

- gerer tous les groupements ;
- entrer dans le contexte d'un groupement choisi ;
- voir les statistiques de chaque groupement ;
- creer, modifier ou desactiver un groupement ;
- choisir l'admin courant d'un groupement ;
- remplacer l'admin d'un groupement par un autre chauffeur du meme groupement.

Son authentification reste separee :

```text
email + mot de passe
```

### Admin de groupement

L'admin d'un groupement n'est pas une personne separee des chauffeurs.

Dans la cible :

- l'admin est un chauffeur du groupement ;
- il possede un acces backoffice ;
- les autres chauffeurs n'ont pas acces au backoffice ;
- le super admin peut remplacer l'admin, par exemple chaque mois, en choisissant un autre chauffeur
  dans la liste du groupement.

Cela veut dire qu'il faut eviter de penser "admin" et "chauffeur" comme deux familles de comptes
totalement separees. Le bon modele cible est plutot :

```text
Driver
  -> compte mobile
  -> peut etre admin courant du groupement
  -> si admin courant : acces backoffice groupement
```

### Chauffeur

Un chauffeur est invite par l'admin du groupement ou par le super admin.

Le formulaire cible ressemble a l'ecran "Invitation d'un taxi" :

- adresse email ;
- ville de licence ;
- numero de licence ;
- eventuellement les informations d'identite et de vehicule selon le besoin produit.

Apres acceptation de l'invitation :

1. le chauffeur choisit son mot de passe ;
2. son compte mobile est active ;
3. un identifiant chauffeur est genere ;
4. cet identifiant est unique dans son groupement.

Exemple :

```text
Groupement A : T1, T2, T3
Groupement B : T1, T2, T3
```

Donc `T1` n'est pas unique dans toute la plateforme. Il est unique seulement avec le groupement.
La vraie unicite technique est :

```text
(groupement_id, driver_identifier)
```

### Authentification cible

Il faut separer deux familles de login.

Super admin :

```text
email + mot de passe
```

Compte groupement, c'est-a-dire admin de groupement ou chauffeur mobile :

```text
identifiant chauffeur + mot de passe + contexte groupement
```

Point critique : comme `T1` peut exister dans plusieurs groupements, l'API ne peut pas identifier
un chauffeur avec seulement `T1 + mot de passe` si aucun groupement n'est connu. Il faut donc une
des solutions suivantes :

- l'application mobile connait deja le groupement, par exemple application marquee ou lien
  d'invitation contenant le groupement ;
- le login demande aussi un `groupementCode` ;
- l'URL ou le sous-domaine donne le groupement ;
- le QR code / lien d'invitation configure le groupement avant le premier login.

Sans ce contexte, deux chauffeurs `T1` dans deux groupements differents seraient ambigus.

### Suppression des roles hors cible

Les roles `SUPERVISOR` et `DISPATCHER` n'ont pas de sens dans la cible actuelle. Ils sont retires
du code applicatif et des nouvelles contraintes SQL.

Ils peuvent encore apparaitre dans d'anciennes migrations deja historisees, mais les migrations
correctives transforment les anciennes donnees `DISPATCHER` / `SUPERVISOR` en `ADMIN`.

---

## 3. Stack backend

Le backend est dans [apps/api](../apps/api).

| Brique            | Choix                                            |
| ----------------- | ------------------------------------------------ |
| Framework         | NestJS 11                                        |
| Serveur HTTP      | Fastify                                          |
| Base de donnees   | PostgreSQL                                       |
| ORM               | TypeORM                                          |
| Auth              | Passport JWT                                     |
| Sessions          | Access token JWT + refresh token cookie HttpOnly |
| Hash password     | Argon2id                                         |
| Queue             | BullMQ + Redis                                   |
| Emails            | Nodemailer + templates Handlebars                |
| Validation API    | class-validator / class-transformer              |
| Logs              | nestjs-pino                                      |
| Documentation API | Swagger                                          |

---

## 4. Pipeline d'une requete HTTP

Quand une requete arrive dans l'API :

1. Fastify recoit la requete.
2. Helmet applique les headers de securite.
3. CORS accepte seulement les origines configurees.
4. Le cookie parser lit les cookies signes.
5. NestJS applique les guards globaux :
   - `ThrottlerGuard` pour le rate limit ;
   - `JwtAuthGuard` pour verifier l'access token ;
   - `RolesGuard` pour verifier les roles.
6. `TenantContextInterceptor` lit `request.user.groupementId` et cree le contexte tenant.
7. `ValidationPipe` valide les DTOs.
8. Le controller appelle le service.
9. Le service fait la logique metier et les transactions.
10. `AuditInterceptor` ecrit une entree d'audit si la route est marquee `@Auditable(...)`.
11. `AllExceptionsFilter` formate les erreurs au format standard.

Routes publiques actuelles :

- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/platform/login`
- `POST /api/v1/auth/groupement/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/users/invitations/:token/accept`
- `POST /api/v1/users/reset-password/:token/accept`
- `POST /api/v1/drivers/invitations/:token/accept`
- Swagger `/api/docs`

---

## 5. Les roles

Les roles sont definis dans :

- [apps/api/src/modules/auth/types/role.enum.ts](../apps/api/src/modules/auth/types/role.enum.ts)
- [packages/shared-config/src/roles.ts](../packages/shared-config/src/roles.ts)

### 5.1 Etat actuel du code

Les roles existants dans le code actuel sont :

| Role          | Sens metier                                                        |
| ------------- | ------------------------------------------------------------------ |
| `SUPER_ADMIN` | Role plateforme. Cree et supervise les groupements.                |
| `ADMIN`       | Admin de groupement. Gere les operations de son propre groupement. |
| `DRIVER`      | Role technique chauffeur mobile. Pas d'acces backoffice seul.      |

`DISPATCHER` est supprime du backend. Les anciennes donnees `DISPATCHER` sont converties en
`ADMIN` par la migration corrective.

Hierarchie appliquee par `RolesGuard` :

```text
SUPER_ADMIN n'inclut pas ADMIN
ADMIN       inclut DRIVER
DRIVER      n'inclut aucun role backoffice
```

Exemple : une route backoffice `@Roles(UserRole.ADMIN)` accepte `ADMIN`, mais elle n'accepte pas
`SUPER_ADMIN`. Le super admin n'est pas un admin operationnel de groupement.

Important : l'API applique maintenant deux niveaux :

- `@Roles(...)` pour le verrou grossier par role ;
- `@Permissions(...)` + `PermissionsGuard` pour verifier la matrice fine `ROLE_PERMISSIONS`.

Pour eviter un crash runtime Node avec les exports TypeScript du package workspace actuel, l'API
garde une copie locale synchronisee dans `apps/api/src/modules/auth/types/permission.enum.ts`.
La source partagee backoffice/API reste documentee dans `packages/shared-config/src/permissions.ts`.

### 5.2 Regle metier validee

```text
SUPER_ADMIN : backoffice plateforme
ADMIN       : backoffice groupement + compte chauffeur
DRIVER      : application mobile seulement
```

Le super admin cree un groupement et invite le premier chauffeur admin. Apres acceptation, ce
chauffeur a les roles `DRIVER` et `ADMIN`, et `drivers.is_group_admin = true`.

---

## 6. Matrice pratique des acces

### 6.1 Matrice actuelle du code

| Module      | Lecture       | Creation            | Modification  | Suppression / action forte |
| ----------- | ------------- | ------------------- | ------------- | -------------------------- |
| Groupements | `SUPER_ADMIN` | `SUPER_ADMIN`       | `SUPER_ADMIN` | `SUPER_ADMIN`              |
| Audit       | `SUPER_ADMIN` | systeme             | systeme       | jamais expose              |
| Users       | `ADMIN+`      | invitation `ADMIN+` | `ADMIN+`      | desactivation `ADMIN+`     |
| Drivers     | `ADMIN+`      | `ADMIN+`            | `ADMIN+`      | offboard `ADMIN+`          |
| Clients     | `ADMIN+`      | `ADMIN+`            | `ADMIN+`      | archive `ADMIN+`           |
| Courses     | `ADMIN+`      | `ADMIN+`            | `ADMIN+`      | delete `ADMIN+`            |

`+` veut dire : le role lui-meme ou un role superieur dans la hierarchie.

### 6.2 Matrice cible souhaitee

| Module / espace            | Super admin                                        | Admin de groupement                       | Chauffeur non admin   |
| -------------------------- | -------------------------------------------------- | ----------------------------------------- | --------------------- |
| Groupements                | creer, consulter, superviser, desactiver si besoin | aucun                                     | aucun                 |
| Statistiques plateforme    | tout                                               | aucun                                     | aucun                 |
| Statistiques du groupement | supervision lecture                                | lecture                                   | selon app mobile      |
| Backoffice groupement      | aucun acces operationnel                           | tout pour son groupement                  | aucun                 |
| Chauffeurs du groupement   | inviter le premier admin lors de la creation       | inviter, consulter, modifier selon regles | son profil mobile     |
| Clients                    | consulter par groupement                           | gerer pour son groupement                 | aucun ou mobile futur |
| Courses                    | consulter par groupement                           | gerer pour son groupement                 | mobile futur          |
| Audit                      | global                                             | groupement, si expose plus tard           | aucun                 |

La cible supprime donc le besoin d'un role lecture seule `SUPERVISOR` pour le moment.

---

## 7. Comment un user arrive dans le systeme

Cette section decrit d'abord le fonctionnement actuel du code, puis le flux cible souhaite.

Il n'y a pas de signup public libre du type "je cree mon compte directement".

Le flux actuel est :

```text
ADMIN/SUPER_ADMIN
    |
    | POST /api/v1/users/invitations
    v
Invitation stockee en base avec token hash
    |
    | Job BullMQ + email
    v
L'utilisateur recoit un lien
    |
    | POST /api/v1/users/invitations/:token/accept
    v
Creation du user + mot de passe hash Argon2id
    |
    | POST /api/v1/auth/login
    v
Access token + refresh cookie
```

### 7.1 Creation d'une invitation

Endpoint :

```http
POST /api/v1/users/invitations
Authorization: Bearer <access_token>
```

Role minimum : `ADMIN`.

Payload :

```json
{
  "firstName": "Nadia",
  "lastName": "Benali",
  "email": "nadia.benali@taxikiwi.local",
  "phoneE164": "+33612345678",
  "roles": ["ADMIN"]
}
```

Ce que fait `UsersService.createInvitation()` :

1. Verifie que l'invitation utilisateur attribue uniquement `ADMIN`.
2. Refuse `SUPER_ADMIN`, `DRIVER`, `DISPATCHER` et tout autre role hors cible.
3. Normalise l'email en lowercase.
4. Genere un token aleatoire.
5. Stocke seulement `SHA-256(token)` dans `user_invitations`.
6. Refuse si un user avec cet email existe deja dans le meme groupement.
7. Refuse si une invitation active existe deja pour cet email.
8. Cree une invitation valable 72 heures.
9. Ajoute un job BullMQ `send-invitation-email`.
10. Retourne les infos publiques de l'invitation.

Le token clair n'est jamais stocke en base. Il existe seulement dans l'email.

### 7.2 Acceptation d'une invitation

Endpoint public :

```http
POST /api/v1/users/invitations/:token/accept
```

Payload :

```json
{
  "password": "StrongPassword12345!"
}
```

Regles :

- mot de passe minimum 12 caracteres ;
- token utilisable une seule fois ;
- token expire apres 72 heures ;
- si le token est deja accepte ou expire, l'API renvoie `410 Gone` ;
- si un user existe deja avec le meme email dans le groupement, l'API renvoie `409 Conflict`.

Ce que fait le service :

1. Hash le token recu avec SHA-256.
2. Cherche l'invitation avec un lock pessimiste.
3. Verifie que le token existe, n'est pas accepte, n'est pas expire.
4. Hash le mot de passe avec Argon2id.
5. Cree le user avec :
   - `groupementId` de l'invitation ;
   - `email`, `firstName`, `lastName`, `phoneE164` ;
   - `roles` de l'invitation ;
   - `isActive = true` ;
   - `passwordHash` ;
   - `passwordUpdatedAt = now`.
6. Marque l'invitation comme acceptee.
7. Retourne le user cree.

### 7.3 Connexion login

Endpoint public :

```http
POST /api/v1/auth/login
```

Payload :

```json
{
  "email": "nadia.benali@taxikiwi.local",
  "password": "StrongPassword12345!"
}
```

Ce que fait `AuthService.login()` :

1. Normalise l'email.
2. Cherche le user dans la table `users`.
3. Utilise `SET LOCAL app.auth_lookup = 'on'` pour bypasser la RLS pendant le lookup auth.
4. Verifie le mot de passe avec Argon2id.
5. Utilise un faux hash si l'email n'existe pas, pour eviter l'enumeration d'emails par timing.
6. Refuse si le compte est desactive.
7. Refuse si le groupement du compte est desactive.
8. Met a jour `users.last_login_at`.
9. Cree une session.
10. Journalise `AUTH_LOGIN` via `AuditService`.

Reponse :

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "email": "nadia.benali@taxikiwi.local",
    "groupementId": "...",
    "roles": ["ADMIN"]
  }
}
```

En plus de la reponse JSON, le backend pose un cookie HttpOnly :

```text
taxikiwi_refresh_token
```

Ce cookie est limite au path :

```text
/api/v1/auth/refresh
```

### 7.4 Access token et refresh token

Access token :

- JWT Bearer renvoye dans le body ;
- TTL par defaut : `15m` ;
- env : `JWT_ACCESS_TTL` ;
- contient `sub`, `email`, `groupementId`, `roles`, `sessionId`, `familyId`, `type: "access"`.

Refresh token :

- JWT stocke dans un cookie HttpOnly ;
- TTL par defaut : `90d` ;
- env : `JWT_REFRESH_TTL` ;
- le hash du refresh token est stocke dans `refresh_tokens`.

### 7.5 Refresh de session

Endpoint public mais protege par `JwtRefreshGuard` :

```http
POST /api/v1/auth/refresh
Cookie: taxikiwi_refresh_token=...
```

Ce que fait le refresh :

1. Lit le refresh token depuis le cookie.
2. Verifie le JWT avec `JWT_REFRESH_SECRET`.
3. Cherche la ligne `refresh_tokens` avec `id = jti` et `tokenHash`.
4. Lock pessimiste de la ligne.
5. Refuse si :
   - token introuvable ;
   - mauvais user ;
   - mauvaise famille ;
   - token deja revoke ;
   - token expire ;
   - user desactive.
6. Revoque l'ancien refresh token.
7. Cree un nouveau couple access + refresh.
8. Stocke le nouveau refresh hash.
9. Ecrit `replacedByTokenId` sur l'ancien token.

Si un refresh token deja revoke est reutilise, le service revoque toute la famille de tokens.
C'est la protection contre le vol/replay de refresh token.

### 7.6 Logout

Endpoint :

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

Ce que fait le backend :

- revoque le refresh token courant (`sessionId`) ;
- supprime le cookie refresh.

### 7.7 Changement de mot de passe par le user connecte

Endpoint :

```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
```

Payload :

```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewPassword12345!"
}
```

Ce que fait le service :

1. Verifie le mot de passe actuel.
2. Hash le nouveau mot de passe.
3. Met a jour `passwordHash` et `passwordUpdatedAt`.
4. Revoque toutes les sessions du user.
5. Supprime le cookie refresh.

Apres changement, les anciens access tokens deviennent invalides parce que `JwtStrategy`
compare `iat` avec `passwordUpdatedAt`.

### 7.8 Reset password par admin

Creation du reset :

```http
POST /api/v1/users/:id/reset-password
Authorization: Bearer <access_token>
```

Role minimum : `ADMIN`.

Regles :

- user cible doit exister dans le groupement courant ;
- user cible doit etre actif ;
- les anciens resets non utilises du meme email sont marques comme acceptes ;
- nouveau token valable 1 heure ;
- email envoye via BullMQ.

Acceptation du reset :

```http
POST /api/v1/users/reset-password/:token/accept
```

Payload :

```json
{
  "password": "NewStrongPassword12345!"
}
```

Ce que fait le service :

1. Verifie token existant, non utilise, non expire.
2. Cherche le user actif correspondant.
3. Hash le nouveau mot de passe.
4. Met a jour `passwordUpdatedAt`.
5. Marque le token comme utilise.
6. Revoque toutes les sessions du user.

### 7.9 Desactivation d'un user

Endpoint :

```http
DELETE /api/v1/users/:id
Authorization: Bearer <access_token>
```

Role minimum : `ADMIN`.

Regles :

- impossible de desactiver son propre compte ;
- si le user est deja desactive : `409 Conflict` ;
- desactivation = `isActive = false`, pas suppression physique ;
- toutes les sessions du user sont revoquees.

### 7.10 Flux cible : invitation d'un chauffeur

Le flux actuel invite un `user` backoffice. Le flux cible doit inviter un taxi/chauffeur.

Flux souhaite :

```text
Admin de groupement ou Super admin
    |
    | Invite un taxi avec email + ville de licence + numero de licence
    v
Invitation chauffeur stockee avec token hash
    |
    | Email envoye au chauffeur
    v
Le chauffeur accepte l'invitation
    |
    | Il choisit son mot de passe
    v
Compte chauffeur active + driver_identifier genere
    |
    | Login mobile
    v
Identifiant chauffeur + mot de passe + contexte groupement
```

Champs minimum de l'invitation chauffeur :

| Champ             | Obligatoire                 | Pourquoi                                             |
| ----------------- | --------------------------- | ---------------------------------------------------- |
| `email`           | oui                         | Envoyer le lien et identifier la personne.           |
| `licenseCity`     | oui ou fortement recommande | Correspond a la ville de licence dans le formulaire. |
| `licenseNumber`   | oui                         | Numero de licence taxi.                              |
| `groupementId`    | oui                         | Savoir dans quel groupement le chauffeur entre.      |
| `invitedByUserId` | oui si acteur connecte      | Audit et responsabilite.                             |

Le backend doit stocker le token seulement sous forme hashee, comme aujourd'hui pour
`user_invitations`.

### 7.11 Flux cible : generation de l'identifiant chauffeur

Apres acceptation de l'invitation, le backend doit generer un identifiant lisible par le chauffeur.

Exemple :

```text
T1, T2, T3, ...
```

Regles :

- l'identifiant est unique dans un groupement ;
- l'identifiant peut etre reutilise dans un autre groupement ;
- il ne doit pas etre modifiable manuellement sauf decision metier explicite ;
- il doit etre genere dans une transaction pour eviter deux chauffeurs `T4` crees en meme temps ;
- l'index base de donnees doit garantir `UNIQUE(groupement_id, driver_identifier)`.

Implementation recommandee :

```text
groupements.driver_identifier_next = 1

Quand un chauffeur accepte :
  1. lock du groupement
  2. lecture de driver_identifier_next
  3. identifiant = "T" + driver_identifier_next
  4. increment driver_identifier_next
  5. creation/activation du chauffeur
```

Alternative : une table dediee `groupement_sequences`. L'important est de ne pas seulement faire
`MAX(identifier) + 1` sans verrou, car deux acceptations simultanees pourraient produire le meme
identifiant.

### 7.12 Flux cible : choisir ou remplacer l'admin d'un groupement

Le super admin doit pouvoir choisir l'admin courant depuis la liste des chauffeurs du groupement.

Flux souhaite :

```text
SUPER_ADMIN
    |
    | ouvre un groupement
    v
liste des chauffeurs du groupement
    |
    | choisit un chauffeur
    v
ce chauffeur devient admin du groupement
    |
    | ancien admin perd l'acces backoffice
    v
sessions backoffice de l'ancien admin revoquees
```

Regles recommandees :

- un groupement doit avoir au maximum un admin courant, sauf decision produit contraire ;
- l'admin choisi doit etre un chauffeur actif du meme groupement ;
- si l'ancien admin est remplace, il garde son compte mobile chauffeur ;
- seul son acces backoffice est retire ;
- le changement doit etre audite ;
- les refresh tokens de l'ancien admin doivent etre revoques pour couper l'ancien acces rapidement.

Modelisation appliquee :

```text
drivers.is_group_admin boolean default false
UNIQUE(groupement_id) WHERE is_group_admin = true
```

Alternative possible plus tard :

```text
groupements.current_admin_driver_id -> drivers.id
```

La premiere option est simple pour filtrer dans la liste des chauffeurs. La deuxieme exprime bien
qu'un groupement a un admin courant. Dans les deux cas, il faut une contrainte pour eviter deux
admins actifs si la regle produit est "un seul admin".

### 7.13 Flux cible : login groupement par identifiant

Le login cible des comptes groupement ne doit pas etre confondu avec le login super admin.

Super admin :

```http
POST /api/v1/auth/platform/login
```

Payload cible :

```json
{
  "email": "superadmin@taxikiwi.local",
  "password": "..."
}
```

Admin/chauffeur :

```http
POST /api/v1/auth/groupement/login
```

Payload cible possible :

```json
{
  "groupementCode": "taxi-kiwi-sevres",
  "identifier": "T1",
  "password": "..."
}
```

Si l'application mobile connait deja le groupement, `groupementCode` peut etre implicite. Mais
cote API, il faut quand meme resoudre un `groupementId` avant de chercher `T1`.

La reponse doit indiquer le type d'acces :

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "driverId": "...",
    "groupementId": "...",
    "identifier": "T1",
    "isGroupAdmin": true
  }
}
```

Ensuite :

- si `isGroupAdmin = true`, le front peut ouvrir le backoffice groupement ;
- si `isGroupAdmin = false`, le front mobile ouvre seulement l'espace chauffeur.

---

## 8. Module Core

Fichiers principaux :

- [apps/api/src/modules/core/core.module.ts](../apps/api/src/modules/core/core.module.ts)
- [apps/api/src/modules/core/config/configuration.ts](../apps/api/src/modules/core/config/configuration.ts)
- [apps/api/src/modules/core/config/validation.schema.ts](../apps/api/src/modules/core/config/validation.schema.ts)
- [apps/api/src/modules/core/database/typeorm.config.ts](../apps/api/src/modules/core/database/typeorm.config.ts)
- [apps/api/src/modules/core/redis/redis.module.ts](../apps/api/src/modules/core/redis/redis.module.ts)
- [apps/api/src/modules/core/health/health.controller.ts](../apps/api/src/modules/core/health/health.controller.ts)

Mission :

- charger et valider les variables d'environnement ;
- configurer PostgreSQL via TypeORM ;
- configurer Redis et BullMQ ;
- configurer le logger Pino ;
- configurer le rate limiting global ;
- exposer les health checks.

Endpoints :

| Methode | Route     | Description                             |
| ------- | --------- | --------------------------------------- |
| `GET`   | `/health` | Liveness simple : API demarree.         |
| `GET`   | `/ready`  | Readiness : verifie PostgreSQL + Redis. |

Variables critiques :

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `ADMIN_ORIGIN` ou `CORS_ORIGIN`

---

## 9. Module Auth

Fichiers principaux :

- [apps/api/src/modules/auth/auth.controller.ts](../apps/api/src/modules/auth/auth.controller.ts)
- [apps/api/src/modules/auth/auth.service.ts](../apps/api/src/modules/auth/auth.service.ts)
- [apps/api/src/modules/auth/strategies/jwt.strategy.ts](../apps/api/src/modules/auth/strategies/jwt.strategy.ts)
- [apps/api/src/modules/auth/strategies/jwt-refresh.strategy.ts](../apps/api/src/modules/auth/strategies/jwt-refresh.strategy.ts)
- [apps/api/src/modules/auth/guards/jwt-auth.guard.ts](../apps/api/src/modules/auth/guards/jwt-auth.guard.ts)
- [apps/api/src/modules/auth/guards/roles.guard.ts](../apps/api/src/modules/auth/guards/roles.guard.ts)
- [apps/api/src/modules/auth/repositories/auth-users.repository.ts](../apps/api/src/modules/auth/repositories/auth-users.repository.ts)

Mission :

- connecter un user backoffice ;
- emettre access token et refresh token ;
- verifier les access tokens ;
- faire la rotation des refresh tokens ;
- gerer logout et changement de mot de passe ;
- fournir les guards `JwtAuthGuard`, `JwtRefreshGuard`, `RolesGuard`.

Endpoints :

| Methode | Route                           | Public              | Description                                                             |
| ------- | ------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `POST`  | `/api/v1/auth/login`            | oui                 | Connexion email/password historique.                                    |
| `POST`  | `/api/v1/auth/platform/login`   | oui                 | Connexion super admin email/password.                                   |
| `POST`  | `/api/v1/auth/groupement/login` | oui                 | Connexion chauffeur/admin par `groupementCode + identifier + password`. |
| `POST`  | `/api/v1/auth/refresh`          | oui + refresh guard | Rotation du refresh token.                                              |
| `POST`  | `/api/v1/auth/logout`           | non                 | Deconnexion.                                                            |
| `POST`  | `/api/v1/auth/change-password`  | non                 | Changement de mot de passe.                                             |
| `GET`   | `/api/v1/auth/me`               | non                 | Retourne le user courant.                                               |

Tables :

- `refresh_tokens`
- `users` est lue via `AuthUsersRepository`.

Securite :

- Argon2id pour les passwords ;
- SHA-256 pour stocker les refresh tokens ;
- cookie refresh HttpOnly ;
- rotation refresh ;
- detection de reutilisation ;
- access tokens invalides apres changement de mot de passe.

---

## 10. Module Tenancy

Fichiers principaux :

- [apps/api/src/modules/tenancy/tenant-context.ts](../apps/api/src/modules/tenancy/tenant-context.ts)
- [apps/api/src/modules/tenancy/tenant-context.interceptor.ts](../apps/api/src/modules/tenancy/tenant-context.interceptor.ts)
- [apps/api/src/modules/tenancy/tenancy.service.ts](../apps/api/src/modules/tenancy/tenancy.service.ts)
- [apps/api/src/modules/tenancy/decorators/current-tenant.decorator.ts](../apps/api/src/modules/tenancy/decorators/current-tenant.decorator.ts)

Mission :

- savoir quel `groupementId` est en train d'utiliser l'API ;
- rendre ce `groupementId` disponible dans toute la requete ;
- propager ce groupement a PostgreSQL pour activer les policies RLS.

Mecanisme :

```text
JWT access token
  -> request.user.groupementId
  -> TenantContextInterceptor
  -> AsyncLocalStorage
  -> TenancyService.withTenantTransaction()
  -> SET LOCAL app.current_groupement_id = $1
  -> PostgreSQL RLS filtre les lignes
```

Chaque module tenant-scoped fait deux protections :

1. `WHERE groupement_id = :groupementId` dans les requetes.
2. RLS cote PostgreSQL avec `app_current_groupement_id()`.

Cette double protection est volontaire.

Pour le `SUPER_ADMIN`, le backend accepte le header `x-groupement-id` sur les routes tenant-scoped.
Cela permet d'entrer dans le contexte d'un groupement choisi tout en gardant la RLS active.

---

## 11. Module Audit

Fichiers principaux :

- [apps/api/src/modules/audit/audit.controller.ts](../apps/api/src/modules/audit/audit.controller.ts)
- [apps/api/src/modules/audit/audit.service.ts](../apps/api/src/modules/audit/audit.service.ts)
- [apps/api/src/modules/audit/audit.interceptor.ts](../apps/api/src/modules/audit/audit.interceptor.ts)
- [apps/api/src/modules/audit/decorators/auditable.decorator.ts](../apps/api/src/modules/audit/decorators/auditable.decorator.ts)

Mission :

- enregistrer les actions sensibles ;
- garder une trace immuable ;
- ne jamais bloquer le flux metier si l'audit echoue.

Table :

- `audit_logs`, partitionnee par mois.

Endpoint :

| Methode | Route                      | Role          | Description                   |
| ------- | -------------------------- | ------------- | ----------------------------- |
| `GET`   | `/api/v1/admin/audit-logs` | `SUPER_ADMIN` | Liste paginee des logs audit. |

Le service masque automatiquement certains champs sensibles :

- `passwordHash`
- `tokenHash`
- `refreshToken`
- `accessToken`
- `secret`
- `cookie`

Important : toutes les actions ne passent pas par `@Auditable`. Certaines sont loggees
manuellement dans les services, par exemple les blacklist clients et les courses.

---

## 12. Module Groupements

Fichiers principaux :

- [apps/api/src/modules/groupements/groupements.controller.ts](../apps/api/src/modules/groupements/groupements.controller.ts)
- [apps/api/src/modules/groupements/groupements.service.ts](../apps/api/src/modules/groupements/groupements.service.ts)
- [apps/api/src/modules/groupements/entities/groupement.entity.ts](../apps/api/src/modules/groupements/entities/groupement.entity.ts)
- [apps/api/src/modules/groupements/entities/groupement-settings.entity.ts](../apps/api/src/modules/groupements/entities/groupement-settings.entity.ts)

Mission :

- gerer les tenants de la plateforme ;
- creer un groupement et ses settings ;
- modifier les infos et les settings ;
- desactiver un groupement.

Table principale :

- `groupements`

Table settings :

- `groupement_settings`

Pourquoi pas de RLS sur `groupements` ?

Parce que le groupement est le tenant lui-meme. Les operations sur les groupements sont reservees
au `SUPER_ADMIN`, qui travaille au niveau plateforme.

Endpoints, tous reserves `SUPER_ADMIN` :

| Methode  | Route                                | Description                                        |
| -------- | ------------------------------------ | -------------------------------------------------- |
| `GET`    | `/api/v1/groupements`                | Liste paginee avec filtre `isActive` et `search`.  |
| `GET`    | `/api/v1/groupements/:id`            | Detail avec settings.                              |
| `POST`   | `/api/v1/groupements`                | Creation groupement + invitation premier admin.    |
| `PATCH`  | `/api/v1/groupements/:id`            | Mise a jour partielle.                             |
| `PATCH`  | `/api/v1/groupements/:id/settings`   | Mise a jour des parametres metier.                 |
| `PATCH`  | `/api/v1/groupements/:id/deactivate` | Desactivation soft delete.                         |
| `DELETE` | `/api/v1/groupements/:id`            | Suppression definitive si aucune donnee ne bloque. |

Regles metier :

- nom commercial unique ;
- code public unique pour le login groupement ;
- creation groupement + settings, puis invitation obligatoire du premier admin ;
- pas d'endpoint super admin pour choisir ou remplacer l'admin chauffeur ;
- `PATCH /deactivate` met `isActive = false` et conserve l'historique ;
- `DELETE` supprime physiquement seulement si PostgreSQL ne trouve aucune donnee metier rattachee.

Settings par defaut :

- `ringTimeoutSeconds = 30`
- `dispatchPolicy = STATION_FIRST`
- service ouvert 7j/7 de 06:00 a 22:00
- `primaryColor = #22C55E`

---

## 13. Module Users

Fichiers principaux :

- [apps/api/src/modules/users/users.controller.ts](../apps/api/src/modules/users/users.controller.ts)
- [apps/api/src/modules/users/users.service.ts](../apps/api/src/modules/users/users.service.ts)
- [apps/api/src/modules/users/entities/user.entity.ts](../apps/api/src/modules/users/entities/user.entity.ts)
- [apps/api/src/modules/users/entities/user-invitation.entity.ts](../apps/api/src/modules/users/entities/user-invitation.entity.ts)
- [apps/api/src/modules/users/users-mailer.service.ts](../apps/api/src/modules/users/users-mailer.service.ts)
- [apps/api/src/modules/users/users-email.processor.ts](../apps/api/src/modules/users/users-email.processor.ts)

Mission :

- gerer les users backoffice d'un groupement ;
- inviter un user ;
- accepter une invitation ;
- modifier un profil ;
- desactiver un user ;
- reset password par email.

Note cible : ce module devra evoluer. Aujourd'hui il gere des users backoffice classiques. Dans la
cible, les comptes de groupement doivent etre rattaches aux chauffeurs, et l'admin du groupement
doit etre un chauffeur promu, pas un user backoffice separe.

Tables :

- `users`
- `user_invitations`

Les deux tables sont tenant-scoped et protegees par RLS.

Champs importants de `users` :

| Champ               | Role                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `id`                | UUID user.                                                          |
| `groupementId`      | Tenant du user. Peut etre `null` pour un user plateforme.           |
| `email`             | Login. Unique par groupement, ou global si `groupementId` est null. |
| `passwordHash`      | Hash Argon2id du mot de passe.                                      |
| `passwordUpdatedAt` | Permet d'invalider les anciens access tokens.                       |
| `roles`             | Tableau de roles.                                                   |
| `isActive`          | Soft delete / desactivation.                                        |
| `lastLoginAt`       | Mis a jour a chaque login email ou login groupement reussi.         |

Endpoints :

| Methode  | Route                                        | Role/Public | Description                                |
| -------- | -------------------------------------------- | ----------- | ------------------------------------------ |
| `GET`    | `/api/v1/users`                              | `ADMIN+`    | Liste users du groupement courant.         |
| `GET`    | `/api/v1/users/:id`                          | `ADMIN+`    | Detail user.                               |
| `POST`   | `/api/v1/users/invitations`                  | `ADMIN+`    | Invite un user par email.                  |
| `POST`   | `/api/v1/users/invitations/:token/accept`    | public      | Cree le compte depuis invitation.          |
| `PATCH`  | `/api/v1/users/:id`                          | `ADMIN+`    | Modifie prenom, nom, telephone, roles.     |
| `DELETE` | `/api/v1/users/:id`                          | `ADMIN+`    | Desactive le user et revoque ses sessions. |
| `POST`   | `/api/v1/users/:id/reset-password`           | `ADMIN+`    | Envoie un email de reset password.         |
| `POST`   | `/api/v1/users/reset-password/:token/accept` | public      | Finalise le reset password.                |

Regles importantes :

- un `ADMIN` ne peut pas attribuer `SUPER_ADMIN` ;
- seul un `SUPER_ADMIN` peut attribuer `SUPER_ADMIN` ;
- un user ne peut pas modifier ses propres roles ;
- un user ne peut pas desactiver son propre compte ;
- invitation valable 72h ;
- reset password valable 1h ;
- token stocke hashe uniquement ;
- emails envoyes en async via BullMQ ;
- templates dans `apps/api/src/modules/users/templates`.

Filtres de liste :

- `page`
- `limit`
- `role`
- `isActive`
- `search` sur prenom, nom, email.

Evolution appliquee / cible du module Users/Auth :

- `SUPERVISOR` et `DISPATCHER` sont retires du code applicatif ;
- le login super admin et le login chauffeur/admin groupement sont separes ;
- le login par identifiant chauffeur + mot de passe + contexte groupement existe ;
- rattacher l'acces backoffice groupement au chauffeur admin courant ;
- ne plus inviter un "user backoffice" pour les chauffeurs simples ;
- utiliser une invitation chauffeur dediee via `driver_invitations`.

---

## 14. Module Drivers

Fichiers principaux :

- [apps/api/src/modules/drivers/drivers.controller.ts](../apps/api/src/modules/drivers/drivers.controller.ts)
- [apps/api/src/modules/drivers/drivers.service.ts](../apps/api/src/modules/drivers/drivers.service.ts)
- [apps/api/src/modules/drivers/entities/driver.entity.ts](../apps/api/src/modules/drivers/entities/driver.entity.ts)
- [apps/api/src/modules/drivers/types/driver-status.enum.ts](../apps/api/src/modules/drivers/types/driver-status.enum.ts)

Mission :

- gerer les chauffeurs d'un groupement ;
- gerer leur statut ;
- stocker vehicule, matricule, telephone ;
- preparer un futur lien avec un compte mobile via `userId`.

Note cible : ce module devient central. Le chauffeur doit porter l'identite metier principale du
compte groupement : identifiant `T1`, `T2`, compte mobile, et eventuellement statut admin du
groupement.

Table :

- `drivers`, tenant-scoped + RLS.

Statuts :

| Statut       | Sens                                 |
| ------------ | ------------------------------------ |
| `ACTIVE`     | Chauffeur actif.                     |
| `SUSPENDED`  | Suspendu temporairement, reversible. |
| `OFFBOARDED` | Sorti du groupement, final cote API. |

Endpoints :

| Methode  | Route                                       | Role     | Description                         |
| -------- | ------------------------------------------- | -------- | ----------------------------------- |
| `GET`    | `/api/v1/drivers`                           | `ADMIN+` | Liste chauffeurs.                   |
| `GET`    | `/api/v1/drivers/:id`                       | `ADMIN+` | Detail chauffeur.                   |
| `POST`   | `/api/v1/drivers/invitations`               | `ADMIN+` | Invite un taxi par email/licence.   |
| `POST`   | `/api/v1/drivers/invitations/:token/accept` | public   | Active le compte chauffeur.         |
| `POST`   | `/api/v1/drivers`                           | `ADMIN+` | Cree un chauffeur actif.            |
| `PATCH`  | `/api/v1/drivers/:id`                       | `ADMIN+` | Modifie les infos hors statut.      |
| `POST`   | `/api/v1/drivers/:id/suspend`               | `ADMIN+` | Suspend un chauffeur actif.         |
| `POST`   | `/api/v1/drivers/:id/reactivate`            | `ADMIN+` | Reactive un chauffeur suspendu.     |
| `DELETE` | `/api/v1/drivers/:id`                       | `ADMIN+` | Passe le chauffeur en `OFFBOARDED`. |

Regles metier :

- matricule format `XX-9999` a `XX-999999` ;
- matricule unique par groupement ;
- telephone normalise en E.164 ;
- pays supporte en Vague 1 : France (`FR`) ;
- `userId` optionnel ;
- un `userId` ne peut etre lie qu'a un seul chauffeur ;
- le user lie doit etre actif et dans le meme groupement ;
- `PATCH` ne change pas le statut ;
- les transitions de statut passent par endpoints dedies ;
- `OFFBOARDED` est final : plus de modification ni transition.

Regles appliquees / cible :

- champ `driverIdentifier`, par exemple `T1` ;
- contrainte `UNIQUE(groupement_id, driver_identifier)` ;
- generation automatique via `groupements.driver_identifier_next` ;
- champs de licence taxi (`licenseCity`, `licenseNumber`) ;
- notion d'acces mobile actif avec `mobileActivatedAt` ;
- notion `isGroupAdmin` ;
- promotion/remplacement admin depuis les chauffeurs du groupement ;
- invitation chauffeur dediee.

Cas particulier :

- le telephone chauffeur n'est pas unique ;
- si un doublon telephone est detecte, le service ecrit un warning dans l'audit :
  `DRIVER_PHONE_DUPLICATE_WARNING`.

---

## 15. Module Clients

Fichiers principaux :

- [apps/api/src/modules/clients/clients.controller.ts](../apps/api/src/modules/clients/clients.controller.ts)
- [apps/api/src/modules/clients/clients.service.ts](../apps/api/src/modules/clients/clients.service.ts)
- [apps/api/src/modules/clients/entities/client.entity.ts](../apps/api/src/modules/clients/entities/client.entity.ts)
- [apps/api/src/modules/clients/entities/client-address.entity.ts](../apps/api/src/modules/clients/entities/client-address.entity.ts)

Mission :

- gerer les fiches clients finaux ;
- rechercher par telephone ;
- gerer les adresses ;
- gerer blacklist ;
- archiver/desarchiver.

Tables :

- `clients`
- `client_addresses`

Les deux sont tenant-scoped + RLS.

Endpoints :

| Methode  | Route                                      | Role     | Description                     |
| -------- | ------------------------------------------ | -------- | ------------------------------- |
| `GET`    | `/api/v1/clients`                          | `ADMIN+` | Liste clients.                  |
| `GET`    | `/api/v1/clients/search`                   | `ADMIN+` | Recherche active par telephone. |
| `GET`    | `/api/v1/clients/:id`                      | `ADMIN+` | Detail client avec adresses.    |
| `POST`   | `/api/v1/clients`                          | `ADMIN+` | Cree une fiche client.          |
| `PATCH`  | `/api/v1/clients/:id`                      | `ADMIN+` | Modifie une fiche active.       |
| `DELETE` | `/api/v1/clients/:id`                      | `ADMIN+` | Archive une fiche.              |
| `POST`   | `/api/v1/clients/:id/unarchive`            | `ADMIN+` | Desarchive une fiche.           |
| `POST`   | `/api/v1/clients/:id/blacklist`            | `ADMIN+` | Blacklist avec motif.           |
| `POST`   | `/api/v1/clients/:id/unblacklist`          | `ADMIN+` | Retire de blacklist.            |
| `POST`   | `/api/v1/clients/:id/addresses`            | `ADMIN+` | Ajoute une adresse.             |
| `PATCH`  | `/api/v1/clients/:id/addresses/:addressId` | `ADMIN+` | Modifie une adresse.            |
| `DELETE` | `/api/v1/clients/:id/addresses/:addressId` | `ADMIN+` | Supprime une adresse.           |

Regles metier :

- telephone client normalise en E.164 ;
- telephone client unique par groupement ;
- si telephone deja utilise : `409 Conflict` avec code `CLIENT_PHONE_ALREADY_EXISTS` ;
- une fiche archivee ne peut pas etre modifiee ;
- `DELETE` archive (`archivedAt`), ne supprime pas physiquement ;
- `unarchive` verifie que le telephone reste disponible ;
- blacklist exige un motif non vide ;
- blacklist/unblacklist sont audites manuellement avec before/after ;
- une seule adresse par defaut par client ;
- si on supprime l'adresse par defaut, une autre adresse peut etre promue par defaut.

Filtres de liste :

- `page`
- `limit`
- `search`
- `phone`
- `isBlacklisted`
- `includeArchived`

---

## 16. Module Courses

Fichiers principaux :

- [apps/api/src/modules/courses/courses.controller.ts](../apps/api/src/modules/courses/courses.controller.ts)
- [apps/api/src/modules/courses/courses.service.ts](../apps/api/src/modules/courses/courses.service.ts)
- [apps/api/src/modules/courses/entities/course.entity.ts](../apps/api/src/modules/courses/entities/course.entity.ts)
- [apps/api/src/modules/courses/types/course-status.enum.ts](../apps/api/src/modules/courses/types/course-status.enum.ts)

Mission :

- saisir manuellement des courses ;
- lister/filtrer les courses ;
- corriger une course saisie ;
- supprimer une course saisie par erreur.

Important : en Vague 1, ce module est volontairement simple.

Il n'y a pas encore :

- appels entrants ;
- dispatch temps reel ;
- GPS ;
- WebSocket ;
- paiement ;
- methode de paiement ;
- workflow chauffeur mobile complet.

Table :

- `courses`, tenant-scoped + RLS.

Statuts :

| Statut      | Sens             |
| ----------- | ---------------- |
| `COMPLETED` | Course terminee. |
| `CANCELLED` | Course annulee.  |
| `NO_SHOW`   | Client absent.   |

Endpoints :

| Methode  | Route                 | Role     | Description      |
| -------- | --------------------- | -------- | ---------------- |
| `GET`    | `/api/v1/courses`     | `ADMIN+` | Liste paginee.   |
| `GET`    | `/api/v1/courses/:id` | `ADMIN+` | Detail course.   |
| `POST`   | `/api/v1/courses`     | `ADMIN+` | Saisie manuelle. |
| `PATCH`  | `/api/v1/courses/:id` | `ADMIN+` | Correction.      |
| `DELETE` | `/api/v1/courses/:id` | `ADMIN+` | Suppression SQL. |

Regles metier :

- `driverId` obligatoire ;
- le chauffeur doit exister dans le meme groupement ;
- `clientId` optionnel ;
- si `clientId` est donne, le client doit exister dans le meme groupement ;
- `pickupAddress` et `dropoffAddress` obligatoires et non vides ;
- `durationMinutes >= 0` ;
- `distanceKm >= 0` ;
- `amountEur` optionnel et seulement indicatif ;
- audit manuel sur creation, update, delete.

Filtres de liste :

- periode `startedFrom` / `startedTo` ;
- `driverId` ;
- `clientId` ;
- `status` ;
- pagination.

---

## 17. Packages partages

Le monorepo contient aussi des packages dans [packages](../packages).

### `@taxikiwi/shared-config`

Contient :

- roles ;
- hierarchie des roles ;
- permissions ;
- codes d'erreur ;
- actions d'audit.

Attention : dans l'API, certains enums/codes sont dupliques localement a cause de la configuration
TypeScript `moduleResolution: "nodenext"`. Les commentaires dans le code disent de garder ces
valeurs synchronisees avec `shared-config`.

### `@taxikiwi/shared-types`

Contient des types de reponse communs :

- `AuthTokenResponse`
- `AuthUserResponse`
- `ApiErrorResponse`
- `PaginatedResponse<T>`

### `@taxikiwi/shared-validators`

Contient les schemas Zod utilises surtout comme reference front/back :

- login ;
- change password.

---

## 18. Base de donnees et migrations

Les migrations sont dans [apps/api/src/migrations](../apps/api/src/migrations).

Elles sont la source de verite du schema. TypeORM `synchronize` est desactive.

| Migration                                        | Role                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `1714000001000-AuthTables`                       | Cree `refresh_tokens`.                                                                                        |
| `1714000002000-RlsPolicies`                      | Cree `app_current_groupement_id()`.                                                                           |
| `1714000003000-AuditPartitions`                  | Cree `audit_logs` partitionnee.                                                                               |
| `1714000004000-GroupementsTables`                | Cree `groupements` + `groupement_settings`.                                                                   |
| `1714000005000-UsersTables`                      | Cree `users` + `user_invitations` + RLS.                                                                      |
| `1714000006000-DriversTable`                     | Cree `drivers` + RLS.                                                                                         |
| `1714000007000-ClientsTables`                    | Cree `clients` + `client_addresses` + RLS.                                                                    |
| `1714000008000-CoursesTable`                     | Cree `courses` + RLS.                                                                                         |
| `1714000009000-DriverAccountsAndGroupementLogin` | Ajoute `groupement.code`, identifiants chauffeur, invitations chauffeur, role `DRIVER`, retrait `SUPERVISOR`. |
| `1714000010000-RemoveDispatcherRole`             | Convertit `DISPATCHER` / `SUPERVISOR` en `ADMIN` et resserre les contraintes de roles.                        |

Commandes utiles :

```bash
pnpm --filter api build
pnpm --filter api test
pnpm --filter api migration:show
pnpm --filter api migration:run
pnpm --filter api start:dev
```

Depuis la racine du monorepo, les raccourcis equivalents sont :

```bash
pnpm api:migration:show
pnpm api:migration:run
pnpm api:migration:revert
pnpm api:schema:log
```

Pour creer ou generer une migration :

```bash
pnpm --filter api migration:create -- src/migrations/NomMigration
pnpm --filter api migration:generate -- src/migrations/NomMigration
```

---

## 19. Isolation multi-tenant par table

| Table                 | Tenant-scoped | RLS        | Note                                              |
| --------------------- | ------------- | ---------- | ------------------------------------------------- |
| `groupements`         | non           | non        | Table plateforme, acces `SUPER_ADMIN`.            |
| `groupement_settings` | indirect      | non        | One-to-one avec groupement.                       |
| `users`               | oui           | oui        | Bypass cible pour login/invitation.               |
| `user_invitations`    | oui           | oui        | Bypass cible pour acceptation token.              |
| `driver_invitations`  | oui           | oui        | Invitations taxi/chauffeur sans signup libre.     |
| `drivers`             | oui           | oui        | Donnees chauffeur d'un groupement.                |
| `clients`             | oui           | oui        | Donnees client d'un groupement.                   |
| `client_addresses`    | oui           | oui        | Adresses client d'un groupement.                  |
| `courses`             | oui           | oui        | Courses d'un groupement.                          |
| `audit_logs`          | oui ou global | oui        | `groupement_id` peut etre null pour audit global. |
| `refresh_tokens`      | lie a user    | non direct | FK vers `users`.                                  |

---

## 20. Erreurs et validation

Le filtre global [AllExceptionsFilter](../apps/api/src/common/filters/all-exceptions.filter.ts)
retourne les erreurs sous une forme stable :

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "La requete contient des erreurs de validation",
  "details": [{ "reason": "..." }],
  "timestamp": "2026-05-02T...",
  "path": "/api/v1/...",
  "requestId": "..."
}
```

Les DTOs refusent les champs inconnus grace au `ValidationPipe` global :

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

---

## 21. Points d'attention avant modifications

Ces points sont importants si on va modifier le backend.

### 21.1 Pas de signup libre

Aujourd'hui, aucun compte metier ne s'inscrit librement.

Un user backoffice classique doit etre invite via `POST /api/v1/users/invitations`.
Un chauffeur doit etre invite via `POST /api/v1/drivers/invitations`, puis accepter son
invitation publique.

Decision actuelle : on garde cette regle. Pas de signup libre.

Si on veut ajouter un vrai signup plus tard, il faudra decider :

- est-ce un signup plateforme ?
- est-ce un signup pour rejoindre un groupement existant ?
- qui valide l'appartenance au groupement ?
- quel role initial donner ?

### 21.2 `groupement.isActive` est verifie au login

Le commentaire de `GroupementsService.deactivate()` est maintenant respecte.

`AuthUsersRepository` joint `groupements` pendant le lookup auth et expose
`groupementIsActive`. `AuthService.login()`, `AuthService.loginWithGroupementIdentifier()` et
`JwtStrategy.validate()` refusent un compte rattache a un groupement desactive.

### 21.3 `lastLoginAt` est mis a jour

Le champ `users.last_login_at` est mis a jour sur login reussi :

- login plateforme email/password ;
- login groupement `groupementCode + identifiant chauffeur + mot de passe`.

Le refresh token ne modifie pas `lastLoginAt`, car ce n'est pas un nouveau login explicite.

### 21.4 Les permissions fines sont appliquees dans l'API

Les controllers gardent `@Roles(...)` pour le verrou grossier, et utilisent maintenant
`@Permissions(...)` pour mapper chaque route a une permission fine.

Le guard global `PermissionsGuard` verifie ces permissions apres l'auth JWT et `RolesGuard`.

### 21.5 Les actions d'audit Auth sont loggees

Le module Auth appelle explicitement `AuditService` pour :

- `AUTH_LOGIN` ;
- `AUTH_REFRESH` ;
- `AUTH_LOGOUT` ;
- `AUTH_PASSWORD_CHANGED` ;
- `AUTH_TOKEN_REUSE_DETECTED`.

Ces actions ne passent pas par `@Auditable`, car plusieurs routes auth sont publiques ou doivent
forcer le `userId` apres validation des credentials.

### 21.6 Creation de groupement et premier admin

`POST /api/v1/groupements` est reserve au `SUPER_ADMIN`. Le payload contient maintenant les
informations du groupement et l'invitation obligatoire du premier admin :

```json
{
  "name": "Taxi Kiwi",
  "code": "TAXI-KIWI",
  "address": "12 rue de Sevres",
  "postalCode": "92310",
  "city": "Sevres",
  "contactEmail": "contact@taxikiwi.fr",
  "contactPhone": "+33145345678",
  "initialAdmin": {
    "email": "admin@taxikiwi.fr",
    "licenseCity": "Sevres",
    "licenseNumber": "LIC-92310-0001"
  }
}
```

Le parcours backend est :

1. `SUPER_ADMIN` cree le groupement.
2. L'API cree les settings par defaut.
3. L'API cree une invitation chauffeur avec `driver_invitations.is_group_admin = true`.
4. Le chauffeur accepte l'invitation et active son compte.
5. L'API cree le user avec `roles = ['DRIVER', 'ADMIN']`.
6. L'API cree le chauffeur avec `drivers.is_group_admin = true`.

Le super admin ne dispose plus d'un endpoint pour choisir ou remplacer l'admin du groupement apres
creation.

### 21.7 Courses est un squelette Vague 1

Le module courses est volontairement manuel. Il ne faut pas le confondre avec le futur systeme
operationnel complet de dispatch, GPS, appels et paiement.

### 21.8 Supprimer `SUPERVISOR` et `DISPATCHER`

Les roles `SUPERVISOR` et `DISPATCHER` ont ete retires du code applicatif, des DTOs et des
packages partages utilises par l'API. Ils ne doivent plus etre utilises dans les nouveaux
developpements backend.

Ce qui a ete fait :

- `apps/api/src/modules/auth/types/role.enum.ts` ;
- `packages/shared-config/src/roles.ts` ;
- `packages/shared-config/src/permissions.ts` ;
- controllers backoffice groupement passes en `ADMIN+` ;
- les DTOs qui exposent `UserRole` ;
- les tests auth/users/drivers/clients/courses ;
- migration corrective `1714000010000`.

Attention : les anciennes migrations peuvent contenir les anciennes valeurs dans leurs contraintes
historiques ou dans les sections `down`. La migration corrective convertit les donnees existantes
en `ADMIN`, puis resserre les contraintes sur `SUPER_ADMIN`, `ADMIN`, `DRIVER`.

### 21.9 Identifiant chauffeur scoped par groupement

Le futur identifiant `T1`, `T2`, etc. ne doit pas etre unique globalement.

Il doit etre unique comme ceci :

```text
UNIQUE(groupement_id, driver_identifier)
```

Donc tout login par identifiant doit connaitre le groupement. Sinon `T1 + password` est ambigu.

### 21.10 Admin de groupement = chauffeur

L'admin du groupement est le premier chauffeur invite par le super admin lors de la creation du
groupement.

Cela implique :

- pas de signup libre ;
- pas d'invitation dispatcher ;
- pas d'endpoint super admin pour remplacer l'admin ;
- un seul chauffeur admin par groupement via l'index `idx_drivers_one_group_admin` ;
- l'admin garde son compte chauffeur mobile grace au role technique `DRIVER`.

### 21.11 Invitation chauffeur differente de l'invitation user actuelle

L'invitation actuelle cree un `user` avec des `roles`.

La cible "Invitation d'un taxi" doit plutot creer ou preparer un `driver` avec :

- email ;
- ville de licence ;
- numero de licence ;
- groupement ;
- token d'acceptation ;
- mot de passe choisi a l'acceptation ;
- identifiant chauffeur genere apres acceptation.

La solution appliquee est une nouvelle table `driver_invitations`. Elle garde le principe important :
pas de signup libre, seulement une acceptation par token envoye par email.

---

## 22. Resume tres court pour les modifications futures

Si on touche aux users :

- comprendre d'abord invitation -> acceptation -> login ;
- ne jamais stocker les tokens en clair ;
- garder `passwordUpdatedAt` pour invalider les anciens tokens ;
- penser a revoquer les refresh tokens quand un mot de passe ou un statut change ;
- verifier la RLS et le `groupementId` partout.

Si on touche aux roles :

- modifier l'enum API et `shared-config` ensemble ;
- verifier `RolesGuard` ;
- verifier tous les controllers ;
- verifier les tests.

Decision appliquee : `SUPERVISOR` et `DISPATCHER` sont retires du code applicatif, et aucun nouvel
usage ne doit etre ajoute.

Si on touche au multi-tenant :

- garder le `WHERE groupement_id = :groupementId` ;
- garder `TenancyService.withTenantTransaction()` ;
- garder les policies RLS ;
- eviter les requetes hors transaction tenant-scoped.

Si on touche aux clients/chauffeurs/courses :

- verifier les validations DTO ;
- verifier les contraintes migrations ;
- verifier l'audit ;
- verifier les transitions de statut et soft delete.

Si on touche aux chauffeurs maintenant :

- ajouter l'identifiant chauffeur scoped par groupement ;
- separer login super admin et login groupement ;
- modeliser admin de groupement comme chauffeur promu ;
- prevoir invitation chauffeur avec licence ;
- proteger la generation `T1`, `T2` par transaction et contrainte unique.
