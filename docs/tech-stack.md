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
- Tauri WebDriver

## Tooling and CI

- Biome
- Lefthook
- GitHub Actions
  - CI runs on pull requests and `main` pushes; docs-only (`docs/**`, `*.md`) changes skip it.
  - Jobs: `quality` (Ultracite, types, disposable PostgreSQL migration tests, unit tests), `web-e2e` (build + Playwright), `desktop-webdriver` (Tauri WebDriver).
  - React Doctor is advisory and reports through its own check and PR comment.

## Deployment

- Railway
- Railpack
- Railway app service: React web build + Hono API
- Railway worker service: Cloudflare Queues HTTP pull consumer
