# Tech stack audit

Target: `docs/tech-stack.md`. Baseline was the working tree before this integration. A dependency declaration alone was not counted as completed integration.

| Technology | Baseline finding and evidence | Current connection and evidence |
| --- | --- | --- |
| TypeScript strict | Present: `packages/config/tsconfig.base.json` sets `strict: true`. | `bun run check-types` covers API, auth, DB, UI, server and web. |
| Bun runtime and package manager | Present: `packageManager` in root `package.json`; server uses `bun run`. | Used for tests, app build, Railway commands and CI. |
| Bun Workspaces | Present: root `workspaces` maps `apps/*` and `packages/*`. | New dependencies stay in their owning app packages. |
| Turborepo | Present: `turbo.json` and root scripts. | Root build passes across all six build tasks. `.next/**` output is cached for Fumadocs, excluding `.next/cache/**`; a second build restored all six tasks from cache. UI `check-types` declares no outputs because it uses `tsc --noEmit`. |
| React | Present: `apps/web/src/main.tsx` mounts React. | Pixel studio is a React route. |
| Vite | Present: `apps/web/vite.config.ts` and web scripts. | Existing React and TanStack Router build pipeline retained. |
| TanStack Router | Present: route plugin, generated route tree and React router provider. | `/studio` is a file route linked from the header. |
| TanStack Query | Present: `QueryClientProvider` and `useQuery` health check. | Existing connection retained. |
| TanStack Form | Present and used in sign in and sign up forms, including Zod validation. | Existing connection retained. |
| TanStack Store | Missing from web dependencies and imports. | `studio-store.ts` holds zoom and color; toolbar and canvas subscribe. |
| TanStack Virtual | Missing from web dependencies and imports. | `/studio` virtualizes IndexedDB draft rows. |
| Tailwind CSS 4 | Present: web Vite plugin and UI global CSS import. | Studio styles use the existing pipeline. |
| Base UI | Present and used by shared UI buttons, inputs and menus. | Studio uses existing UI package elsewhere in the app. |
| Lucide | Present and rendered by header controls and shared components. | Existing connection retained. |
| dnd-kit | Missing from dependencies and imports. | Studio frame list uses sortable context and drag end reorder. |
| Fumadocs | Present: Next app, MDX source and docs routes. | Existing docs app retained. |
| Pixel editor TypeScript | No editing route or domain code. | Studio route stores frame pixels in typed arrays and local drafts. This is a small functional editor slice, not the full PRD editor. |
| Canvas 2D | No `getContext("2d")` use. | Studio paints exact pixels through Canvas 2D with `imageRendering: pixelated`; Playwright asserts pixel alpha. |
| PixiJS 8 | Missing from dependencies and imports. | `ScenePreview` creates a PixiJS application and displays the active canvas as a nearest-neighbor sprite. |
| Hono | Present: server router, auth route and middleware. | Adds upload URL, upload completion and health routes; serves the React build. |
| oRPC | Present: shared router, RPC handler and client. | Existing connection retained. |
| Zod 4 | Present and used in auth forms and oRPC conversion. | New upload and Queue payloads are also validated by Zod. |
| OpenAPI | Present: OpenAPI handler and reference plugin. | Existing `/api-reference` connection retained. |
| Neon PostgreSQL | Present: `@neondatabase/serverless` client and `DATABASE_URL` config. | Isolated branch test job validates schema on a temporary Neon branch when CI credentials are configured. |
| Drizzle ORM and Kit | Present: Neon Drizzle client, schema and Kit commands. | CI branch job runs `db:push` before DB test. |
| Cloudflare Queues | Missing config, producer and worker. | Server publishes an asset key after R2 upload; separate worker pulls, validates, checks object and ACKs or retries leases. Mocked API contract tests pass. |
| Better Auth | Present: server auth handler, Drizzle adapter and React client. | Asset endpoints require a session and owner-prefixed key. |
| Cloudflare R2 | Missing SDK, config and endpoints. | Server signs scoped PNG/WebP PUT URLs; client uploads directly and completion checks object existence. Wrangler CORS policy template added. Live bucket access still requires credentials and policy application. |
| Dexie / IndexedDB | Missing from dependencies and imports. | Local drafts persist and reload in the Studio route. Playwright exercises a save. |
| Tauri File System | Tauri shell existed, but no FS plugin or permissions. | FS plugin registered with AppData write scope; Studio creates the app data export directory and writes PNG in desktop mode. Desktop WebDriver export test passes. |
| Tauri 2 | Present Rust shell, but default `com.tauri.dev` identifier prevented building. | Identifier updated; WebDriver feature is isolated in test configuration. |
| Vitest | Missing. | Toolbar interaction test runs in jsdom. |
| Testing Library | Missing. | Vitest test renders toolbar and changes zoom through a labeled control. |
| Playwright | Missing. | Browser test draws a pixel, checks its alpha and saves a Dexie draft. |
| Neon test branch | Missing. | CI creates a temporary branch, pushes schema, checks auth table, then deletes branch. Requires `NEON_PROJECT_ID` and `NEON_API_KEY`; not run locally against an existing database. |
| Tauri WebDriver | Missing. | WebdriverIO Tauri service and feature-gated embedded driver added; Rust feature check, desktop build and Studio session test pass. |
| Biome | Present through Ultracite, but repository-wide check initially had 552 errors and 54 warnings. | `bun run check` passes for all 159 scanned files. Formatting, accessible UI markup and lint findings were corrected. The config excludes generated files and disables rules that misidentify Bun workspace imports or conflict with existing generic UI component patterns; TypeScript and builds validate imports. |
| Lefthook | Present in root configuration. | Existing staged-file formatting hook retained. |
| GitHub Actions | No `.github` workflow. | CI runs lint, types, unit tests, the full monorepo build and browser tests; separate optional Neon branch and desktop WebDriver jobs. |
| Railway / Railpack | No service definition. | `.railway/railway.ts` defines app and worker services with build, start and health commands. Service source and live deployment require a linked Railway project and repository. |

The Cloudflare worker currently verifies upload existence. The PRD's durable operation record, transactional outbox and reconciliation remain product work. See `docs/deployment.md` for required service settings.

## Verification performed

| Command or check | Result |
| --- | --- |
| `bun run check-types` | 6 package tasks passed. |
| `bun run check` | Ultracite checked 159 files with no diagnostics. |
| `bun run test` | Vitest toolbar test passed; two Bun Queue transport tests passed. |
| `bun run test:e2e` | Playwright drew a pixel, checked its alpha, saved a Dexie draft, reloaded, reopened the draft, and checked the pixel again. |
| `bun run --cwd apps/web desktop:test:build` and `desktop:test` | Tauri desktop build succeeded; embedded WebDriver saved a draft and exported PNG to AppData. |
| `bun run build:app` | Vite built the React site; Hono bundle built. No PWA manifest or service worker is emitted. |
| `bun run build` | All six monorepo build tasks passed; a repeat run restored all six from Turbo cache, including Fumadocs. |
| Production server smoke check | `/health` and `/studio` returned HTTP 200. |
| `.railway/railway.ts` standalone TypeScript check | Passed; a live Railway plan needs a linked project. |

Cloudflare R2/Queues, a temporary Neon branch, and Railway services could not be exercised against live accounts because this checkout has no linked account credentials or Git remote. Those production connections still require live configuration and verification. The executable lint, type, build, unit, browser, and desktop checks above passed.

The web build still reports a chunk-size advisory for its 586 kB minified entry bundle. Vite development also logs a React warning from the existing `next-themes` script injection in this client-rendered app; the theme and Studio browser flows still run. These are observable warnings, not failed checks.

PWA was removed from the target stack by product decision. The earlier PWA plugin, manifest, service worker and icon addition have been removed.
