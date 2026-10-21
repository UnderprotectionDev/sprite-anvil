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
  - CI enables them against a disposable PostgreSQL service behind the local Neon HTTP proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`, pinned by digest), so tests use the production `neon-http` driver. `createDb` routes only the reserved host `db.localtest.me` to the proxy (`packages/db/src/local-neon-proxy.ts`).
- Tauri WebDriver

## Tooling and CI

- Biome
- Lefthook
- GitHub Actions
  - CI runs on every pull request and `main` push. A `changes` job (dorny/paths-filter) skips the heavy jobs for docs-only (`docs/**`, `*.md`) changes and skips `desktop-webdriver` for server- or Fumadocs-only changes.
  - Jobs: `docs` (lychee offline Markdown link and heading check, configured in `lychee.toml`), `quality` (Ultracite, types, unit tests), `integration` (disposable PostgreSQL migration tests and server integration tests), `web-e2e` (build + Playwright including database-backed flows; report and traces uploaded on failure), `desktop-webdriver` (Tauri WebDriver; driver logs and failure screenshots uploaded on failure).
  - `ci-ok` aggregates every job and is the single check to require on `main`; a skipped job passes it.
  - Shared Bun setup lives in `.github/actions/setup` and test database preparation in `.github/actions/test-database`; Bun, Playwright browser, desktop apt packages and Rust builds are cached.
  - React Doctor is advisory, runs only when `apps/web`, `apps/fumadocs` or `packages/ui` changes, and reports through its own check and PR comment.

## Deployment

- Railway
- Railpack
- Railway app service: React web build + Hono API
- Railway worker service: Cloudflare Queues HTTP pull consumer
