# Sprite Anvil

Sprite Anvil is a ChatGPT-first, provider-neutral workspace for producing and managing 2D game art. It is designed to keep project context, asset families, versions, review evidence, quality checks, and engine-neutral exports connected across web and desktop workflows.

The product requirements live in [`docs/prd/`](docs/prd/README.md), domain language in [`docs/CONTEXT.md`](docs/CONTEXT.md), architecture decisions in [`docs/adr/`](docs/adr/), workflow guidance in [`docs/workflow/`](docs/workflow/), and the selected technologies in [`docs/tech-stack.md`](docs/tech-stack.md).

## Repository structure

```text
apps/
  web/          React + TanStack Router web app; Tauri desktop shell in src-tauri/
  server/       Hono API and Cloudflare Queues worker
  fumadocs/     Next.js product documentation site
packages/
  api/          Shared oRPC contracts and routers
  auth/         Better Auth configuration
  config/       Shared TypeScript configuration
  db/           Drizzle schema and versioned SQL migrations
  ui/           Shared UI components and styles
docs/           Product requirements, domain glossary, ADRs, and workflows
cloudflare/     Cloudflare configuration examples
.railway/       Railway app and worker service configuration
```

`bts.jsonc` records the Better-T-Stack generator configuration. The product requirements and this repository's technical decisions are maintained separately from that generator metadata.

## Getting started

Use Bun 1.3.13, then install the workspace dependencies:

```bash
bun install
```

Environment variable definitions are maintained in the owning `.env.schema` files: `apps/web/.env.schema`, `apps/server/.env.schema`, and `packages/db/.env.schema`. Put local values in ignored `.env.local` files under the owning app or package, and never commit secrets. The server requires `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `CORS_ORIGIN`; the web app requires `VITE_SERVER_URL`. Optional Cloudflare and R2 settings are needed for upload and queue workflows. Run `bun run env:generate` after changing a schema; installation also generates the Varlock TypeScript accessors.

For a database schema change, update `packages/db/src/schema/`, generate a versioned migration, and review its SQL and snapshot before applying it:

```bash
bun run db:generate
# Review SQL in packages/db/src/migrations/
bun run db:prepare
bun run db:ready
```

Workspaces share one explicitly authorized development database; no workspace DB branches are provisioned or promoted. Set both `NEON_DEVELOPMENT_ENDPOINT_HOST` and `NEON_DEVELOPMENT_DATABASE_NAME` (or a single named `DB_DEVELOPMENT_TARGETS` declaration), independently from production. `db:prepare` validates source SQL/snapshots/schema in disposable local PostgreSQL, verifies each target's history and real schema, applies compatible pending migrations with canonical Drizzle Kit under an exclusive lease, then verifies again. Local `initdb`/`postgres` are required for preparation (or set `DB_POSTGRES_BIN`). `db:migrate` uses the same path. Timestamped migration directories are canonical; this version has no legacy journal. Applied and unknown-status SQL/snapshots are preserved, including narrowly pinned historical repairs. See [`docs/development-database.md`](docs/development-database.md) for target configuration, coordination, historical inventory and parallel issue delivery, and [`docs/deployment.md`](docs/deployment.md) for production.

## Development

Start the workspace:

```bash
bun run dev
```

Run/dev performs read-only runtime compatibility before starting dependent processes; it never migrates, pushes, repairs or seeds. Agents prepare pending migrations and manual data before handoff. Missing authorization, stale source evidence, pending required migrations, divergent history, unsupported schema changes or a held migration lease block startup. Compatible ahead history may Run with an unchanged local prefix and the narrow additive-column policy; migration writing and `db:ready` still require full reconciliation. APIs keep shared DB leases while running; request an owner-controlled `Stop` window before preparing migrations. No other workspace is terminated.

Conductor's local `Run` uses `.conductor/settings.toml` and the same fixed localhost defaults as `bun run dev`: web `http://localhost:3001`, API `http://localhost:3000`, docs `http://localhost:4000`. Its `nonconcurrent` mode stops the previous Conductor-managed Run for this repository before starting another workspace. The launcher does not kill unrelated port owners. `bun run dev:parallel` opts into Conductor's allocated ports (API `CONDUCTOR_PORT`, web +1, docs +2) for simultaneous terminal-launched workspaces. Repository-local overrides take precedence; replace any legacy switch command or `concurrent` override. `bun run dev:server` is also guarded; `bun run dev:web` is DB-independent UI-only. Start the documentation site alone with `bun run --cwd apps/fumadocs dev`.

Run the Tauri desktop app with:

```bash
bun run --cwd apps/web desktop:dev
```

## Common commands

| Command | Purpose |
| --- | --- |
| `bun run build` | Build all workspace packages and apps |
| `bun run build:app` | Build the web app and server |
| `bun run check` | Run Ultracite formatting and lint checks |
| `bun run check-types` | Check TypeScript across the workspace |
| `bun run test` | Run database, web and server tests |
| `bun run test:e2e` | Run Playwright web application smoke tests |
| `bun run --cwd apps/web desktop:test:build` | Build the Tauri WebDriver test app |
| `bun run --cwd apps/web desktop:test` | Run Tauri WebDriver smoke tests |
| `bun run db:generate` | Generate versioned SQL from the Drizzle schema |
| `bun run db:migrate` | Apply reviewed versioned migrations |
| `bun run db:prepare` | Validate source, prepare each authorized development DB and verify readiness |
| `bun run db:runtime` | Read-only Run compatibility check; not delivery readiness |
| `bun run db:ready` | Read-only source/history/schema readiness check |
| `bun run db:validate` | Validate source SQL/snapshots/schema in disposable local PostgreSQL |
| `bun run db:push` | Push schema to a disposable database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run auth:generate` | Generate the Better Auth database schema |
| `bun run env:generate` | Generate Varlock TypeScript accessors |

Shared UI components live in `packages/ui`. Add shared primitives from the repository root with:

```bash
bunx --bun shadcn@latest add button dialog popover -c packages/ui
```
