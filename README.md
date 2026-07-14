# Pointage360

Pointage360 est une plateforme SaaS B2B multi-tenant pour gerer le pointage entree/sortie, les timesheets, les conges, la presence par site, les validations manager/RH et les rapports RH/paie.

Le projet est concu comme un pilote interne pouvant evoluer vers un vrai produit vendable a plusieurs societes clientes ayant des sites.

## Stack

- Monorepo pnpm workspaces + Turborepo
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui compatible, lucide-react, TanStack Table, React Hook Form, Zod, date-fns
- Backend: NestJS, TypeScript, REST API, Swagger/OpenAPI, DTOs, Guards, Services, Controllers
- Database: PostgreSQL, Prisma ORM, migration initiale, seed
- Auth: JWT access token, refresh token, bcryptjs, RBAC, RolesGuard, TenantGuard
- Jobs/cache: Redis, BullMQ queues pour exports, notifications, rappels timesheets, rapports
- Storage: MinIO/S3 compatible via StorageService
- DevOps: Docker Compose, GitHub Actions, ESLint/Prettier, README

## Architecture

```txt
backend/    NestJS backend
frontend/   Next.js frontend
packages/
  config/   eslint, prettier, tsconfig
  types/    types partages
  ui/       helpers UI partages
prisma/
  schema.prisma
  migrations/
  seed.ts
docker/
```

Le frontend ne reference jamais Prisma. Toutes les donnees passent par l'API NestJS.

## Installation

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Services:

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- MinIO Console: http://localhost:9001

## Variables d'environnement

Voir `.env.example`.

Variables principales:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `REDIS_HOST`
- `REDIS_PORT`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `NEXT_PUBLIC_API_URL`

## Commandes

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm build
pnpm build:api
pnpm build:web
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:web
pnpm lint
pnpm lint:api
pnpm lint:web
pnpm arch:check
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm db:studio
```

## Comptes de test

Mot de passe pour tous: `Password123!`

- `superadmin@pointage360.test`
- `admin@societe-a.test`
- `hr@societe-a.test`
- `manager@societe-a.test`
- `employee@societe-a.test`

## Roles

- `SUPER_ADMIN`: gere tenants, abonnements et statistiques globales
- `TENANT_ADMIN`: gere sa societe, utilisateurs, employes, sites, settings et rapports
- `HR`: gere employes, conges et exports RH/paie
- `MANAGER`: valide pointages, timesheets, conges equipe et consulte ses sites
- `EMPLOYEE`: pointe, remplit sa timesheet, demande un conge et consulte ses donnees

## Multi-tenant

- Tous les modeles metier ont `tenantId`.
- Les guards globaux chargent le user depuis la base, puis valident role et tenant.
- `TenantGuard` refuse les tenants suspendus.
- Les services appliquent toujours `tenantId` depuis le contexte serveur.
- Le frontend ne fournit pas de `tenantId` de confiance.
- `getCurrentUserContext()` retourne `userId`, `tenantId`, `role`, `permissions`, `email`, `fullName`.

## Modules API

- Auth: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`
- Dashboard: `/api/dashboard/summary`
- Tenants: `/api/tenants`
- Subscriptions: `/api/subscriptions`
- Users: `/api/users`
- Employees: `/api/employees`
- Sites: `/api/sites`
- Attendance: `/api/attendance`
- Timesheets: `/api/timesheets`
- Leave: `/api/leave`
- Reports: `/api/reports/*`
- Settings: `/api/settings/*`
- Notifications: `/api/notifications`
- Audit logs: `/api/audit-logs`

Swagger est disponible sur `/api/docs`.

## Workflows

Timesheet:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `APPROVED -> REOPENED`

Leave request:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `SUBMITTED -> CANCELLED`

Attendance:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `APPROVED -> REOPENED`

Chaque transition cree une entree `ApprovalAction` et un `AuditLog`.

## Seed

Le seed cree:

- plans Trial, Pro, Enterprise
- tenants Societe Alpha BTP et Societe Atlas Construction
- sites CH-001 a CH-005
- comptes de test
- 15 employes supplementaires
- affectations sites
- pointages de la semaine
- timesheets et lignes
- types de conges Maroc
- soldes conges
- jours feries Maroc
- audit logs et notifications exemples

## Notes de developpement

Sur cette machine, Docker n'etait pas installe au moment de la verification. Les commandes verifiees localement sont:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

`pnpm build` compile l'API NestJS, le frontend Next.js et les packages partages.

Le lint ESLint flat config est egalement verifie avec:

```bash
pnpm lint
```

## Deploiement production

Le deploiement recommande pour un domaine Heberjahiz est un VPS/Cloud avec Docker Compose et Caddy pour HTTPS automatique.

Guide detaille: [docs/deploiement-heberjahiz.md](docs/deploiement-heberjahiz.md)

## Fonctionnalites completees (v0.2)

- **Settings UI** : onglets reels Societe, Jours feries, Types de conges avec formulaires CRUD.
- **BullMQ processors** : 4 workers — exports CSV vers MinIO, notifications, rappels timesheets, rapports agregats.
- **Upload MinIO** : endpoint upload justificatifs conges, migration SQL, BookingModal avec file picker.
- **Emails transactionnels** : MailModule Nodemailer global, 5 templates HTML — approbation/rejet conge, soumission approbateurs, rappel timesheet, confirmation check-in.
- **API client complete** : CRUD leave, attendance, timesheet, settings, upload.
- **Pages detail enrichies** : team/[id] avec soldes conges et pointages. sites/[id] avec affectations et lien carte.
- **Page demandes de conge** : Approuver/Refuser en temps reel, filtre statut, refresh automatique.
- **Hook useApiData** : ajout refresh() pour recharger apres une action.

## Prochaines etapes

- Ajouter tests unitaires et e2e (Jest + Supertest, Playwright).
- Ajouter permissions fines en plus des roles.
- Ajouter OpenTelemetry/Sentry pour l'observabilite production.
- Configurer SMTP reel (SMTP_HOST/SMTP_USER/SMTP_PASS dans .env).
