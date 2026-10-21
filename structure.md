# structure.md

Ownership rules for application code: where each kind of code lives and what may import what. It holds rules, not a file listing; read the real tree with `git ls-files apps packages`. A path named here is a place where code may live, not delivered scope.

## Where does it go?

| Code | Home |
|---|---|
| Behavior that belongs to one product capability | That feature (see Features) |
| A page route registration | `apps/web/src/routes/` |
| Header, theme, project navigation, a product component two or more features use | `apps/web/src/components/` |
| Contract or router | `packages/api` |
| Table, migration | `packages/db` |
| Sign-in SDK, session, cookies | `packages/auth` |
| Generic interface primitive | `packages/ui` |
| Worker entry, service wiring, environment | `apps/server/src/` root |
| Server, contract or schema code two features need | The owning `packages/` directory, never one feature importing the other |
| A script | The `scripts/` folder of the workspace that owns it |
| A test | In the feature that owns the code (see Tests); end-to-end tests in `apps/web/e2e/` or `apps/web/desktop-e2e/` |

## Workspaces

- `apps/web`: Vite + TanStack Router interface, Tauri shell (`src-tauri/`), end-to-end tests.
- `apps/server`: Cloudflare worker, service wiring, per-feature server code.
- `apps/fumadocs`: documentation site.
- `packages/api`, `packages/db`, `packages/auth`, `packages/ui`, `packages/config`: contracts and routers, database, authentication, interface primitives, shared TypeScript configuration (see Packages).

## Features

A feature is a cohesive product capability whose UI, server behavior, schema and state change together. It is a domain slice, not a page: only some features have a routed view, the rest are panels another feature's view uses.

One name in four places, the glossary's canonical English term in `kebab-case`. Example for `asset-versions`:

| Layer | Path |
|---|---|
| Interface | `apps/web/src/features/asset-versions/` |
| Server | `apps/server/src/features/asset-versions/server/` |
| Contract and router | `packages/api/src/asset-versions.ts`, `packages/api/src/routers/asset-versions.ts` |
| Schema | `packages/db/src/schema/asset-versions.ts` |

**Opening one**
- Create a feature directory only when it owns implemented code. A server-only feature has no web directory; a UI-only feature has no `server/`.
- None of these alone makes a feature: a table, a route, a CRUD verb, a provider SDK or config, a webhook or cron entry, a migration, a small toggle, a future capability.

**Naming**
- A collection surface is plural (`collections`); a lifecycle takes its process name (`imports`). A CRUD verb is never a feature name.
- `core`, `domain`, `management`, `resources`, `workspace` and `metadata` are not feature names; they hide the real surfaces. A shared behavior boundary (`<name>-core`) opens only when two or more real features consume it.

**Boundaries**
- A feature does not import another feature's web folders (`ui/`, `hooks/`, `lib/`, `store/`) or `server/` internals. No tool enforces this yet; check it in review. Shared code moves up one level:
  - a web component that carries product meaning goes to `apps/web/src/components/`;
  - server, contract or schema code goes to the owning `packages/` directory.
- Auth, search, settings, notifications, reporting, jobs, i18n and theme become features only when they carry their own user-facing behavior, lifecycle or management surface. Their SDK, helper or config does not.
- Last filter, selected record, restored route and onboarding progress are not features. They live in the owning feature's `store/`, `params.ts` or `lib/`; a named app-level helper only when several features consume them.

## Web

### App root

```text
apps/web/src/
├── routes/        TanStack file routes
├── features/      see below
├── components/    app shell and components shared by two or more features
├── lib/           auth client
├── utils/         app-wide helpers: oRPC and query clients, error handling
├── env.ts         generated from .env.schema
├── index.css
└── main.tsx
```

- A route file stays thin: it registers the route and composes one feature view. Feature code stays in the feature.
- Route files follow the TanStack file-route naming; `_auth/` holds the routes behind sign-in.
- `routeTree.gen.ts` and `env.ts` are generated; edit the source and regenerate.

### Where an interface component lives

| Layer | Path | Use when |
|---|---|---|
| Primitive | `packages/ui` | It knows no product term (button, dialog, field) |
| Shared product component | `apps/web/src/components/` | It carries product meaning and two or more features use it |
| Feature component | `apps/web/src/features/<feature>/ui/components/` | One feature uses it |

Start in the feature and promote one level when a second feature needs it.

### Feature folders

A feature's web code sits in `apps/web/src/features/<feature>/`; its server code is in a separate app, so every folder here is web code. `ui/` holds what the feature renders; the folders beside it hold what does not. Open only the folders the feature owns; do not copy one template into every feature.

| Folder | Holds |
|---|---|
| `ui/views/` | A file a route renders directly |
| `ui/components/` | Everything else the interface renders: panels and parts a view or another component uses |
| `ui/forms/` | Form components |
| `hooks/` | The feature's hooks |
| `lib/` | Plain TypeScript without JSX: labels, constants, mappers, helpers |
| `store/` | Feature-owned state |

At the feature root only:
- `params.ts`: the feature's URL or search-parameter contract.
- `schemas.ts`: input, form and domain validation. It is never the database schema.
- `types.ts`: feature-owned types.

Always:
- `ui/` holds only the three folders above and no loose files; JSX goes in `ui/`, everything else beside it.
- Tests belong to the feature that owns the code; see Tests.
- No `index.ts` barrel; add one only for a controlled public boundary and say why.
- A folder beyond this table needs a reason stated in the change. `shared`, `common`, `utils`, `services`, `config` and `global` are not feature folders.
- A primitive missing from `@sprite-anvil/ui` is composed in the owning feature's `ui/components/` until a second feature needs it.

## Server

- `apps/server/src/features/<feature>/server/` holds the feature's server code; its tests sit in `server/tests/`.
- An HTTP or RPC entry is a thin adapter that calls the feature's server code; the feature's `server/` owns the behavior.
- `apps/server/src/` root holds app-wide code only: worker entry, service wiring, context, environment, Cloudflare access.
- A background-job or scheduled entry belongs to the provider boundary; the behavior it triggers stays in the feature's `server/`.

## Packages

- `packages/api`: contract and router files are named after their feature. `routers/index.ts` composes the app router. Files that serve every feature (`context.ts`, `error-contract.ts`, `output-contracts.ts`, `index.ts`) stay at the `src/` root.
- `packages/db`: schema files are named after their feature. Migrations follow `docs/agents/issue-tracker.md`. The `src/` root holds package-wide code: configuration, environment, relations and the test helper.
- `packages/auth`: the Better Auth SDK, cookies and session setup. The sign-in interface is a web feature; SDK clients, callbacks and bootstrap stay here.
- `packages/ui`: generic primitives only, nothing feature-specific. `components/` holds primitives, `hooks/` and `lib/` hold their helpers, `styles/` holds the shared stylesheet.
- Open a new package only when two or more apps consume it, it has real exports, or an architecture decision names it. "It might be shared later" is not enough.
- The web app never imports server source. It reaches the server through the `packages/api` contract and its own oRPC client.

## Tests

A test belongs to the feature that owns the code it covers and moves or is deleted with it.

| Test | Home | Name |
|---|---|---|
| Web unit or component | Next to the file: `x.tsx` and `x.test.tsx` | `*.test.ts(x)` |
| Route test | Next to the route file in `routes/`, with a leading `-` so TanStack does not register it as a route | `-*.test.tsx` |
| Server unit | `server/tests/` of the feature | `*.test.ts` |
| Server integration (database or other infrastructure) | `server/tests/` of the feature | `*.integration.test.ts` |
| Test helper or fixture | Beside the tests that use it; used by two features, it goes to the owning `packages/` directory | any name without `.test.` |
| Package test | Next to the file it covers inside that package | `*.test.ts` |
| Browser end-to-end | `apps/web/e2e/`, one spec per feature or flow, named after it | `<feature>.spec.ts` |
| Desktop (Tauri) end-to-end | `apps/web/desktop-e2e/`, same naming | `<feature>.spec.ts` |
| End-to-end fixture or flow helper | Beside the specs that use it | `<feature>-fixture.ts`, or a flow name |

- A test never imports another feature's internals; it follows the same boundary as the code.
- End-to-end specs stay in the app's `e2e/` folders, not inside a feature: they drive the whole running app.

## Scripts and root files

- A script lives in the `scripts/` folder of the workspace that owns it (`apps/server/scripts/`, `packages/db/scripts/`).
- A root configuration file (`biome.json`, `turbo.json`, `lefthook.yml`, `bts.jsonc`, `tsconfig.json`) stays at the repository root only when it applies to the whole repository; a workspace-specific one goes in that workspace.
