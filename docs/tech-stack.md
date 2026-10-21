# Tech Stack

## Core

- TypeScript (`strict`)
- Bun (runtime ve package manager)
- Bun Workspaces
- Turborepo

## Frontend

- React
- Vite
- TanStack Router
- TanStack Query
- TanStack Form
- TanStack Store
- TanStack Virtual
- Tailwind CSS 4
- Base UI (through `@sprite-anvil/ui` components)
- Lucide and Pixelarticons
- dnd-kit
- Fumadocs

PWA kullanılmayacak; web uygulaması için service worker ve kurulum manifesti eklenmeyecek.

## Responsibilities

Each responsibility is built with its technology, not with the substitute beside it. `bun run check:conventions` rejects the substitutes marked with a check ([guide](agents/conventions.md)); review judges the rest.

| Responsibility | Technology | Rejected substitute |
|---|---|---|
| Form state, validation and submission | TanStack Form with Zod | A `<form>` whose controls keep their own `useState` or prop callbacks; check `form-state` |
| Interface controls | Base UI through `@sprite-anvil/ui` | A raw `<button>`, `<input>`, `<select>` or `<textarea>` where `@sprite-anvil/ui` has the primitive; check `raw-control`, exception with a reason |
| Server data in the web app | oRPC client with TanStack Query | A `fetch` call in `apps/web/src`; check `raw-fetch`, exception with a reason |
| Offline browser data | Dexie | The `indexedDB` API used directly; check `raw-indexeddb` |
| State several components share | TanStack Store | A module-level mutable store, or a context used as one |
| Long lists | TanStack Virtual | Hand-written windowing |
| Drag and drop | dnd-kit | HTML drag events on sortable items |
| Navigation | TanStack Router | `window.location` assignment, or `<a href>` to an app route |

## Pixel Editor

- TypeScript
- Canvas 2D

## Scene Preview

- PixiJS 8

## Backend

- Hono
- oRPC
- Zod 4
- OpenAPI

## Database and Queue

- Neon PostgreSQL
- Drizzle ORM
- Drizzle Kit
- Cloudflare Queues (background work)

## Authentication

- Better Auth

## Storage

- Cloudflare R2 (uploaded and generated files)
- Dexie / IndexedDB (offline browser data)
- Tauri File System (desktop local files)

## Desktop

- Tauri 2

## Testing

- Vitest
- Testing Library
- Playwright
- Opt-in database integration tests
  - CI runs them in the `integration` job against a PostgreSQL service: profile tests use their own loopback databases cloned from a `db:push` schema template, and `createDb` (neon-http) tests go through the local Neon HTTP proxy in a non-blocking step until their known failures are fixed (`ghcr.io/timowilhelm/local-neon-http-proxy`, pinned by digest). `createDb` routes only the reserved host `db.localtest.me` to the proxy (`packages/db/src/local-neon-proxy.ts`).
- Tauri WebDriver

## Tooling and CI

- Biome
- Lefthook
- GitHub Actions
  - CI runs on every pull request and `main` push. A `changes` job (dorny/paths-filter) skips the heavy jobs for docs-only (`docs/**`, `*.md`) changes and skips `desktop-webdriver` for server- or Fumadocs-only changes.
  - Jobs: `docs` (lychee offline Markdown link and heading check, configured in `lychee.toml`), `quality` (Ultracite, types, unit tests), `integration` (disposable PostgreSQL migration tests and server integration tests), `web-e2e` (build + database-independent Playwright flows; report and traces uploaded on failure), `desktop-webdriver` (Tauri WebDriver; driver logs and failure screenshots uploaded on failure).
  - `ci-ok` aggregates every job and is the single check to require on `main`; a skipped job passes it.
  - Shared Bun setup lives in `.github/actions/setup` and test database preparation in `.github/actions/test-database`; Bun, Playwright browser, desktop apt packages and Rust builds are cached.
  - React Doctor is advisory, runs only when `apps/web`, `apps/fumadocs` or `packages/ui` changes, and reports through its own check and PR comment.
  - The `Conventions` workflow runs `bun run check:conventions` on every pull request and `main` push, docs included; unlike the jobs above it is not skipped for docs-only changes.

## Deployment

- Railway
- Railpack
- Railway app service: React web build + Hono API
- Railway worker service: Cloudflare Queues HTTP pull consumer
