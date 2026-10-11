# Shared development database operations

## Ownership and targets

All Conductor workspaces use one explicitly authorized development PostgreSQL database. Production is a separately declared target. Project creation/archive never creates database branches or prepares a database. Credentials stay in ignored environment files or secure Conductor environment settings.

The authorized shared development identity is direct endpoint `ep-holy-frost-zapt8ycl.c-2.eu-west-2.aws.neon.tech`, database `neondb`; defaults are pinned in `packages/db/.env.schema`. A different endpoint or database needs explicit authorization. `DATABASE_URL_UNPOOLED`, when present, must identify the same database as `DATABASE_URL`. `DB_DEVELOPMENT_TARGETS` accepts exactly one application target. A URL, Git branch or `NODE_ENV` does not authorize a target.

## Parallel issue workflow

Each issue carries its owning implementation, source schema, original migration SQL and snapshot together. Applied artifacts and database migration records are immutable.

1. Before generating or applying a migration, run `bun run db:doctor`. It reads shared history and identifies missing or changed identities by name, timestamp and SQL hash. For missing applied migrations it searches Git for the matching original SQL, snapshot and owning schema commit, and prints its subject and containing refs. An unresolved source is a blocker.
2. Reconcile missing history with `bun run db:sync` from a clean workspace. It fetches `origin` main and pull-request heads, verifies exact SQL bytes and the owning snapshot/schema, and merges complete owning commits. Only commits reachable from `origin/main` or a cached PR head verified against the same `origin` remote are eligible; local-only branches and other remotes are excluded. Provenance is rechecked before merging. It preserves local edits by refusing a dirty workspace; a merge conflict is left visible for normal resolution. It never copies SQL alone, rewrites applied artifacts or changes the database. `bun run db:sync --check` performs diagnosis without fetch or merge; cached PR heads are checked with a read-only remote lookup.
3. Generate with `bun run db:generate`. The command verifies the exact shared applied prefix before invoking Drizzle Kit. Another issue's interleaved migration requires reconciliation first. Review all generated SQL and snapshots, including defaults, foreign keys and data loss, before preparation.
4. Run `bun run db:prepare`. Source identity, SQL hashes, snapshot lineage and generated Drizzle schema are checked. Under the exclusive migration lease, shared schema introspection must agree with the reviewed pending SQL plus the pinned historical exceptions. Only compatible pending history is applied through canonical Drizzle Kit. History and physical schema are verified afterward.
5. Run affected tests and finish with `bun run db:ready`. Runtime compatibility is not delivery readiness. Report target failures independently and preserve existing shared test data.

A workspace can run behind another issue when its own applied migration identities/hashes and required schema remain valid. It does not have to import an unrelated compatible feature merely to start its API. Migration generation, preparation and delivery remain stricter and require fully reconciled history.

## Validation without temporary PostgreSQL

Development setup, `db:validate`, `db:prepare`, `db:runtime`, `db:ready` and Run do not create temporary PostgreSQL instances. `db:validate` checks source identities/snapshots and inspects the authorized shared target in a read-only transaction. It compares installed Drizzle Kit's introspection plan against source and reviewed pending SQL; the introspection plan's `apply` function is never called. Preparation alone executes pending versioned SQL.

This is live schema verification, not a replay of the complete SQL chain on an empty database. A pending SQL plan that cannot be matched to the schema diff, including data-only backfills, fails closed and requires a separate reviewed delivery decision. A missing shared connection blocks live validation; static source inspection and DB-free tests remain possible.

The version-3 `.context/db-source-validation.json` receipt is written only after successful shared inspection. It binds the source fingerprint, required physical catalog and catalog hash. Source/schema, migration, lockfile or verifier changes invalidate it. Missing, stale or old replay receipts are refreshed through read-only shared inspection, including on Run. Receipt refresh never applies migrations or seeds data. A fresh process reloads the full schema import graph on each supervisor check; a matching receipt avoids repeated Drizzle introspection while actual history/catalog are still checked under the API lease.

The old disposable full-chain replay helpers and integration fixtures remain available for explicitly opted-in maintenance audits (`DB_TEST_POSTGRES=true`). They are optional and are not invoked by the development commands or setup. Feature-specific opt-in integration/e2e helpers may have their own disposable fixtures; they are not part of Run.

## Runtime compatibility

Runtime verifies local migration identities as an ordered subsequence of the shared history, permitting migrations from other issues between them. Missing local migrations, changed SQL/timestamps, malformed identities and reordering remain blockers. Migration writes and ready delivery require the exact ordered applied prefix.

Every required existing schema object retains its verified catalog definition. Unknown changes on existing tables are not silently accepted. Supported unrelated additions are:

- Nullable built-in columns on existing ordinary tables, without defaults, identity, generation, custom collation or added constraints/indexes.
- Independent ordinary tables without RLS/forced RLS, using supported built-in column types, no identity/generation/custom defaults, and validated primary-key/unique constraints and valid indexes. `now()` and `gen_random_uuid()` defaults are supported on these unused tables.

Extra foreign keys are conservatively blocked because they can change existing parent writes. Extra triggers, functions, policies, enums, invalid indexes and unvalidated constraints are also blocked. Reconcile the owning implementation with `db:sync` rather than bypassing compatibility. Equal history with unexpected physical objects is drift, not an ahead migration.

## Coordination and fixed Run ports

Conductor Run uses backend `3000`, frontend `3001`, and Fumadocs `4000`, with matching authentication/CORS/client URLs. The tracked and machine-local Run commands explicitly set `DEV_USE_CONDUCTOR_PORTS=false`. Repository Run remains `nonconcurrent`: one Conductor-managed workspace for this repository uses these fixed ports at a time. The Mac client reads tracked configuration after it reaches the remote default branch; machine-local overrides take effect on this machine.

`bun run dev:parallel` remains an explicit terminal opt-in for allocated workspace ports. It does not change the Conductor Run default. The launcher never discovers or terminates processes in other repositories. A process already holding a fixed port must be stopped by its owner; no global switch script is invoked.

An API holds a shared advisory lease for its lifetime; preparation needs the exclusive lease on the same key. For a migration window, ask owners to Stop their running workspaces, prepare, then restart. The supervisor stops only its own child on lost lease, changed required schema or incompatible source edits. Direct production/API launches and out-of-band SQL do not acquire this cooperative development lease.

## Historical schema and limitations

`historical-schema-inventory.json` pins immutable historical SQL hashes and exact catalog residues: legacy columns, indexes, constraints and the two reviewed `NOT VALID` checks. Its introspection statements describe differences to ignore, never repair commands to execute. The default-expression introspection exception is additionally pinned to its exact actual catalog definition so a changed default cannot hide behind it. Drift outside these explicit exceptions fails.

The two reviewed snapshotless historical repairs remain immutable; new migrations require snapshots. Never edit database migration rows, manufacture a baseline, renumber applied artifacts or use `db:push` to conceal conflict. Push remains restricted to an explicitly disposable loopback target.

Catalog checks cover schema definitions, not shared business-data isolation or every PostgreSQL privilege/extension setting. Installed Drizzle introspection differences fail closed for investigation. One shared database cannot accept contradictory changes to the same schema object without reconciliation.

## Testing Decisions

- `runtime-compatibility.test.ts` and `runtime-history.test.ts` cover independent additions, interleaved history, immutable own migrations, missing requirements, parent-write foreign keys, custom defaults, triggers and RLS refusal.
- `shared-schema-policy.test.ts` covers exact pending-plan matching, quoted SQL literals, required-object projection and refusal of arbitrary repair/data-only SQL. `shared-source.test.ts` checks source preparation without PostgreSQL creation or a pre-existing receipt.
- `migration-reconciliation.test.ts` uses real disposable Git repositories, not databases, to verify byte-exact provenance, whole-commit integration, changed-hash refusal and preservation of dirty workspaces.
- Existing file/policy tests cover target authorization, production separation, snapshot lineage, immutable history and historical residues. Environment/configuration tests cover fixed Run ports, explicit allocated-port opt-in and Varlock environment isolation.
- Live `db:doctor`, `db:validate`, `db:runtime`, `db:prepare` and `db:ready` are separate evidence. A no-pending preparation is a verified no-op, not evidence that new DDL or data backfills were exercised. Optional replay suites are reported separately when explicitly run.

Same-name CHECK expressions and constraint timing flags are verified independently of Drizzle's diff before a fresh schema proof is written. PostgreSQL's `EXPLAIN` without `ANALYZE` compares source and catalog CHECK expressions with the same column types, preserving normal casts, parentheses and `IN`/`ANY` canonicalization. Deferrable constraints and `NO INHERIT` checks are rejected because the source schema does not declare them. This verification creates no temporary tables or PostgreSQL instances and executes no repair SQL.
