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
- Base UI
- Lucide
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
- Cloudflare Queues

## Authentication

- Better Auth

## Storage

- Cloudflare R2
- Dexie / IndexedDB
- Tauri File System

## Desktop

- Tauri 2

## Testing

- Vitest
- Testing Library
- Playwright
- Neon test branch
- Tauri WebDriver

## Tooling and CI

- Biome
- Lefthook
- GitHub Actions

## Deployment

- Railway
- Railpack
- Railway app service: React web build + Hono API
- Railway worker service: Cloudflare Queues HTTP pull consumer


Builder dışında eklenecekler: Base UI, Tailwind CSS 4, Lucide, TanStack Query/Form/Store/Virtual, dnd-kit, Zod 4, Cloudflare R2, Cloudflare Queues, Dexie ve Railway yapılandırması.
