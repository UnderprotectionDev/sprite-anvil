# Shared development database operations

## Ownership and targets

Conductor workspaces share explicitly configured development PostgreSQL databases. Neon remains the provider and the application's product `Project` records are unchanged. Project creation/archive never creates/deletes DB branches, prepares baselines or promotes databases. Production has separate endpoint/database declarations and an explicit deployment command; neither `NODE_ENV`, a URL's appearance nor a branch name establishes its environment.

Store credentials and declarations in ignored environment files or secure Conductor repository environment settings, copied to workspaces through Files to copy. Keep `DATABASE_URL` for application traffic and optional matching `DATABASE_URL_UNPOOLED` for direct migration/coordination sessions. For one Neon development DB, set `NEON_DEVELOPMENT_ENDPOINT_HOST` (direct hostname, no `-pooler`) and `NEON_DEVELOPMENT_DATABASE_NAME` to values verified by its owner. Set production's distinct `NEON_PRODUCTION_ENDPOINT_HOST` and `NEON_PRODUCTION_DATABASE_NAME` independently. Declarations are operator authorization, not a provider attestation; reconfirm them when endpoints are reassigned. Do not put credentials in Git or logs.

The owner has explicitly authorized the current shared `DATABASE_URL` target: direct endpoint `ep-holy-frost-zapt8ycl.c-2.eu-west-2.aws.neon.tech`, database `neondb`. These non-secret development identity defaults are pinned in `packages/db/.env.schema`; credentials remain external. A different `DATABASE_URL` does not automatically become authorized: explicitly reconfirm and configure its endpoint/database identity. Production is not configured by this development declaration and remains fail-closed until independently declared.

For multiple databases using this package's schema/history, configure `DB_DEVELOPMENT_TARGETS` as JSON:

```json
[
  {"name":"application","connectionEnv":"DATABASE_URL","directConnectionEnv":"DATABASE_URL_UNPOOLED","host":"ep-development.example.aws.neon.tech","database":"app"},
  {"name":"secondary","connectionEnv":"SECONDARY_DATABASE_URL","host":"ep-secondary.example.aws.neon.tech","database":"app_secondary"}
]
```

Replace example hosts with independently verified allowed direct hosts. `connectionEnv` references a secret environment variable, not a URL in the JSON. Names and host/port/database identities must be unique and the application's `DATABASE_URL` must be included. Every target has its own migration history and readiness check; this is not a multi-schema migration registry. A future independently owned schema needs its own canonical source/validator, not this package's SQL applied indiscriminately. Loopback development also requires `NEON_LOCAL=true` and explicit host/database declarations. `db:push` additionally requires `DB_PUSH_DISPOSABLE=true` and is never preparation for a shared target.

## Commands and source evidence

After changing the source schema, generate and review the owning issue's versioned migration:

```sh
bun run db:generate
bun run db:prepare
bun run db:ready
```

`db:prepare` (also `db:migrate`) first checks migration identities/order, nonempty SQL, installed snapshot format and parent lineage, and current schema against the latest snapshot. Installed Drizzle Kit `1.0.0-rc.4` uses timestamped directories with SQL/snapshots, not a legacy journal. It replays the **complete** history with canonical Drizzle Kit in disposable local PostgreSQL, independently verifies SQL prefixes, and compares the final catalog against generated source DDL plus the pinned historical inventory. The actual target must match the catalog of its applied prefix before any write. Validated source is copied and fingerprint-checked before canonical target migration; after application the full history and actual catalog are rechecked.

Local `initdb` and `postgres` must be available (or set `DB_POSTGRES_BIN` to their bin directory), running as a non-root user. The verifier owns a temporary cluster on a random loopback port and cleans up only its own process/directory. It never uses a managed target as scratch. No PostgreSQL binaries are needed for readiness after a current proof exists. `bun run db:validate` validates source without any shared DB access, so independent implementation can continue while a target is blocked.

Conductor's local workspace setup runs `bun run db:validate` after installing dependencies, generating this proof for each new local worktree. Cloud setup skips the local PostgreSQL replay. Existing workspaces do not rerun setup when this setting changes; run `bun run db:validate` once in an existing workspace that has no current proof.

The atomic `.context/db-source-validation.json` proof binds SQL, snapshots, generated schema, dependency manifest/lockfile and verifier/inventory versions to prefix catalog hashes. It is local validation evidence, **not** a DB migration record or baseline. It expires on those changes; Run does not refresh it or replay SQL. Never author a proof manually. `db:ready`/Run inspect current source and read target history/catalog under a shared lease; missing/stale proof, pending migrations, unclassified target, ahead/divergent history or drift fails closed with a preparation/reconciliation message. No migration, push, reset, seed or automatic repair runs at startup.

## Coordination and Run

Preparation uses an exclusive session advisory lock; development uses the same key's shared lock for the complete API process lifetime. Concurrent APIs may hold shared leases, but preparation fails while any is running, and Run fails while preparation is running. A heartbeat stops only this runner's own child if its DB lease is lost. Ask owners to `Stop` their workspaces for a migration window; no other workspace's processes are discovered or killed. Coordination is cooperative: direct API/worker launchers, old workspace scripts, external SQL and production processes do not acquire this development lease. Integrate this workflow into all active development workspaces before relying on it; coordinate production deployment separately.

The tracked `.conductor/settings.toml` connects local `Run` to guarded `bun run dev`. Default development restores fixed localhost ports: API `3000`, web `3001`, docs `4000`, with matching authentication, CORS and client URLs. Only one workspace can use these fixed ports at a time. Conductor uses `nonconcurrent` mode: starting Run stops the previous Conductor-managed Run for this repository before launching the selected workspace. The development launcher itself never kills another workspace's processes. For simultaneous workspaces launched from terminals, use `bun run dev:parallel`, which explicitly opts into workspace-allocated API/web/docs ports (`CONDUCTOR_PORT`, +1, +2). Shared DB safety comes from the leases/readiness gate, not workspace isolation. Port binding is strict; conflicts with processes outside Conductor fail instead of killing an owner. Missing guarded scripts in older workspaces fail closed. Repository-local settings outrank shared settings: replace any local `concurrent` mode or legacy switch command without changing unrelated environment values. The shared Mac configuration takes effect after merge to the remote default branch; the repository-local override applies on this machine. The previous global switch script may serve other repositories; do not delete it globally.

For this machine's explicitly requested cross-repository fixed-port handoff, the Run command checks readiness first, then invokes the existing `$HOME/.conductor/scripts/switch-local-dev.zsh --stop-only` through `zsh` when the file exists, then starts guarded development. That script permits only recognized development processes in the approved `sprite-anvil` and `cantiara` Conductor workspace roots; other port owners remain untouched. `nonconcurrent` alone only coordinates workspaces of the same repository. Machines without this optional script do not automatically stop another repository. A runtime port error is not a migration error and does not require `db:prepare`.

`bun run dev:server` and the server package's `dev` use the same gate. `bun run dev:web` remains a DB-independent UI-only workflow, not proof that a feature's API is ready. Direct `src/index.ts`/production start is outside the development launcher and never auto-migrates. Commands report only safe names/errors, not secret URLs.

Targets prepare sequentially with independent results. If DB A migrates and DB B fails, A stays migrated; there is no cross-database transaction/rollback. Reinspect both before retrying; Run requires every configured target to pass. A failed postcheck may follow an already committed migration, so do not assume failure means nothing changed.

## Immutable history and repairs

Applied migrations, names, snapshots and database records remain immutable. Keep an unknown-application-status migration until all permanent targets have been checked; one development database does not prove global absence. Recover missing applied history with its original schema and owning code from a trusted Git source. Do not fabricate migration rows or baseline a divergent target.

The two SQL-only repairs `20260925080000_legacy_asset_schema_bridge` and `20260925203212_asset_record_foreign_key_restore` are preserved in the canonical chain. They are the only reviewed historical snapshotless exceptions; new migrations require snapshots. The bridge, foreign-key restore, merge migrations and existing constraint repair SQL still contribute to full replay and applied identity verification; they are not alternative startup repair commands.

`packages/db/scripts/historical-schema-inventory.json` pins exact source SQL hashes and exact source-vs-replay catalog differences: the nullable legacy `asset_version_review_events.asset_family_id`, historical extra indexes/constraints, and two historical `custom_purpose` checks explicitly marked `NOT VALID`. These objects and validation states are preserved rather than silently dropped or reported validated. The inventory accepts only the reviewed differences; added drift or changed pinned SQL fails. Correcting these residues later requires a new reviewed migration and a deliberate source/inventory update, never rewriting applied artifacts.

Catalog verification covers relations, columns/defaults/types/nullability, indexes, constraints including validation state, enums, functions, triggers, sequence configuration, policies and views. PostgreSQL 18's additional validated `NOT NULL` constraint rows are normalized because column nullability already represents them; unvalidated constraint rows remain checked. It does not verify business data, ownership/grants, extension configuration or every PostgreSQL catalog property. CI/local replay may use a different PostgreSQL major version; unsupported semantic/deparser differences fail closed for investigation, not automatic acceptance. Local proofs are workspace evidence, not cryptographic attestation against a malicious workspace owner.

The unused remote `DB_MIGRATE_TARGET=test` path and its endpoint configuration have been removed with the old CI-Neon test seam. Disposable integration tests create their own local targets; they never reuse application credentials. `development` and explicit deployment `production` are the only persistent migration environments.

## Parallel issue example

1. Issue A adds a column. Its agent generates/reviews A's SQL and snapshot, runs affected independent tests and `db:prepare`, prepares issue-owned manual records, and finishes with `db:ready`. The user can use `Run` and the agent's real route/control/record instructions.
2. Issue B started before A. B's `db:ready` reports that the shared DB is ahead. B continues independent code, integrates A's verified owning commit (code/schema/SQL/snapshot together), and regenerates **only globally confirmed unapplied** B artifacts against A. If A is running, B asks A's owner to `Stop`; B never kills A. B then prepares its pending migration, test data and readiness. A must integrate B's applied history before its next Run. Simultaneous unmerged incompatible histories remain blocked until integrated; a shared DB is not isolation.

## Testing Decisions

- Policy/file tests cover explicit endpoint/database identities, production separation, direct/pooled pairing, snapshot format/lineage and exact applied prefix/hash refusal.
- `DB_TEST_POSTGRES=true bun test packages/db/scripts/database-preparation.integration.test.ts packages/db/scripts/migration-source.integration.test.ts` uses disposable local PostgreSQL only. It covers compatible pending preparation, unchanged records under read-only readiness, ahead/divergent history, drift including unvalidated constraints, shared/exclusive coordination, missing/stale source proof, actual child no-spawn/start and independent multi-DB partial failure. Full-chain replay protects immutable repairs and pinned catalog differences.
- Historical inventory tests reject arbitrary extra drift and changed source SQL hashes. Port environment tests cover default localhost ports, opt-in workspace URLs/ports and secret preservation.
- A real Varlock subprocess test checks that the development launcher discards the database package's injected resolution cache before starting the server. The server resolves its own schema from the preserved environment instead of reusing the database package's narrower imported keys.
- A disposable backend-termination test verifies lease loss stops only the supervised child. Lease cleanup awaits Bun's reservation release and uses a bounded connection close, including after disconnect; closing the owned session releases its advisory locks.
- The database-script Biome override permits awaited loops: SQL statements, migration prefixes and target leases must be ordered, not parallelized by a performance autofix. Other lint rules remain enabled.
- Live read-only history/catalog audits are separate evidence; no live preparation claim follows from local tests. Destructive scenarios never target managed development or production. CI provisions local PostgreSQL binaries, not Neon branches or management credentials.
