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

For a database schema change or a new database, generate and review a versioned migration before applying it:

```bash
bun run db:generate
# Review SQL in packages/db/src/migrations/
bun run db:migrate
```

Use `bun run db:push` only with a disposable local database. See [`docs/deployment.md`](docs/deployment.md) for Railway, Cloudflare Queues, and R2 deployment configuration.

## Development

Start the workspace:

```bash
bun run dev
```

The web app runs at `http://localhost:3001`, the API at `http://localhost:3000`, and Fumadocs at `http://localhost:4000`. To start only the web app or API, use `bun run dev:web` or `bun run dev:server`. Start the documentation site alone with `bun run --cwd apps/fumadocs dev`.

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
| `bun run test` | Run web unit tests and server tests |
| `bun run test:e2e` | Run Playwright web application smoke tests |
| `bun run --cwd apps/web desktop:test:build` | Build the Tauri WebDriver test app |
| `bun run --cwd apps/web desktop:test` | Run Tauri WebDriver smoke tests |
| `bun run db:generate` | Generate versioned SQL from the Drizzle schema |
| `bun run db:migrate` | Apply reviewed versioned migrations |
| `bun run db:push` | Push schema to a disposable database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run auth:generate` | Generate the Better Auth database schema |
| `bun run env:generate` | Generate Varlock TypeScript accessors |

Shared UI components live in `packages/ui`. Add shared primitives from the repository root with:

```bash
bunx --bun shadcn@latest add button dialog popover -c packages/ui
```
