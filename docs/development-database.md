# Shared development database operations

## Ownership and targets

All Conductor workspaces use one explicitly authorized development PostgreSQL database. Production is a separately declared target. Project creation/archive never creates database branches or prepares a database. Credentials stay in ignored environment files or secure Conductor environment settings.

The authorized shared development identity is direct endpoint `ep-cold-surf-bafbsaxt.c-8.eu-central-1.aws.neon.tech`, database `neondb`; defaults are pinned in `packages/db/.env.schema`. A different endpoint or database needs explicit authorization. `DATABASE_URL_UNPOOLED`, when present, must identify the same database as `DATABASE_URL`. `DB_DEVELOPMENT_TARGETS` accepts exactly one application target. A URL, Git branch or `NODE_ENV` does not authorize a target.

## Parallel issue workflow

Each issue carries its owning implementation, source schema, original migration SQL and snapshot together. Applied artifacts and database migration records are immutable. Workspaces share one development database and never get a per-workspace database or Neon branch, so every migration must keep older code from other branches working.

### Expansion-only migrations

Every migration not listed in `packages/db/scripts/migration-expansion-baseline.json` (the migrations that existed when the rule started) must be expansion-only. `bun run db:check` (CI, `db:generate`, `db:validate`, `db:prepare`) compares each migration's snapshot with its parent snapshots and scans its SQL without contacting a database.

- Allowed: new tables, nullable or defaulted columns, non-unique indexes, new options in a text CHECK list or as an added `OR` alternative, and constraints/indexes that older writes cannot violate because they involve only new columns and hold for the row older writes get: new nullable columns are NULL and the other new columns take their verified defaults.
- Rejected: dropping or renaming a table or column, changing a column type, making an existing column `NOT NULL`, adding a `NOT NULL` column that older writes cannot fill (without a default, or a `NOT NULL` generated column whose expression may yield `NULL`; identity columns always fill themselves and stay allowed), removing the default of a `NOT NULL` column, new or narrowed CHECK, foreign key, unique constraint/index or primary key on existing columns, dropping a unique constraint/index or primary key (an `ON CONFLICT` target), changing a unique constraint/index toward more rows or fewer key columns, a new foreign key to an existing table whose `onDelete` is not `cascade`, `set null` or `set default`, removing an enum value, and adding a trigger, rule or row-level security policy.

A violation names the migration, the change and the fix: add the column nullable or with a default; keep the old column and support both shapes in code; keep the database constraint broad and enforce the narrow rule in application validation.

An intentional contracting change needs `-- parallel-safety: contract <reason>` as the first SQL line. Only the first line counts. The check then passes with a warning; coordinate that migration so every workspace runs the code that tolerates it first.

### Migration identity and rebases

Development identifies a migration by the SHA-256 hash of its SQL, not by name, date or position.

- A shared record whose hash no workspace migration has belongs to another branch and is accepted. Doctor, validation, readiness and runtime report how many such records exist. Their expansion additions (nullable or defaulted columns, new tables, enum values, widened CHECKs and constraints or indexes that only involve their new columns) are not drift.
- A workspace migration without a record of its hash is pending, whatever its date. `db:prepare` applies pending migrations in directory order, in one transaction on the connection that holds the exclusive migration lease. It verifies the migrated schema before `COMMIT`; any failure rolls back everything and records nothing.
- A record with the same name or timestamp but a different hash means applied SQL was edited or regenerated. This blocks preparation; restore the original SQL bytes.
- Rebase rule: move your unmerged migration to the end of main. Its directory name, order and date may change, and the same SQL is recognized as already applied. Never change or regenerate SQL that a shared database has applied.

Production deployment (`db:migrate:deploy`) is unchanged: canonical Drizzle Kit applies main in exact order, and an extra or reordered record is an error. Nothing writes to migration files or the journal automatically.

### Steps

1. Run `bun run db:doctor`. It reads shared history, reports pending migrations and other branches' records, and for those records shows the owning Git source when one is published. `bun run db:sync` remains available when this workspace needs another branch's code; it is optional for migrations.
2. Generate with `bun run db:generate`, then review all generated SQL and snapshots, including defaults, foreign keys and data loss. Generation runs the expansion check.
3. Stop APIs that use the shared database before migration: preparation needs the exclusive lease that every running API holds in shared mode.
4. Run `bun run db:prepare`. Source identity, SQL hashes, snapshot lineage, the expansion rule and the generated Drizzle schema are checked first. Before any pending development SQL is applied, the complete owning HEAD must be committed in a clean workspace and reachable from current origin/main or a verified origin PR (draft is sufficient). SQL and snapshot bytes must match that published HEAD, and each pending migration must have a verified owning schema/SQL/snapshot commit. A pushed branch without a PR does not satisfy the trust contract.
5. Run affected tests and finish with `bun run db:ready`. Runtime compatibility is not delivery readiness. Report target failures independently and preserve existing shared test data.

Conductor Setup installs dependencies and tooling without validating or preparing the database. Run and `dev:server` perform the read-only compatibility check before startup, keep the shared advisory lease while running, and never apply migrations. Preparing the required reviewed migrations remains a separate agent-owned step.

## Validation without temporary PostgreSQL

Development setup, `db:validate`, `db:prepare`, `db:runtime`, `db:ready` and Run do not create temporary PostgreSQL instances. `db:validate` checks source identities/snapshots and inspects the authorized shared target in a read-only transaction. It compares installed Drizzle Kit's introspection plan against source and reviewed pending SQL; the introspection plan's `apply` function is never called. Preparation alone executes pending versioned SQL.

This is live schema verification, not a replay of the complete SQL chain on an empty database. A pending SQL plan that cannot be matched to the schema diff, including data-only backfills, fails closed and requires a separate reviewed delivery decision. A missing shared connection blocks live validation; static source inspection and DB-free tests remain possible.

The version-3 `.context/db-source-validation.json` receipt is written only after successful shared inspection. It binds the source fingerprint, required physical catalog and catalog hash. Source/schema, migration, lockfile or verifier changes invalidate it. Missing, stale or old replay receipts are refreshed through read-only shared inspection, including on Run. Receipt refresh never applies migrations or seeds data. A fresh process reloads the full schema import graph on each supervisor check; a matching receipt avoids repeated Drizzle introspection in both the Run precheck and API supervision while actual history/catalog are still checked under the shared lease. Preparation and delivery readiness retain full source introspection even with a matching receipt.

The old disposable full-chain replay helpers and integration fixtures remain available for explicitly opted-in maintenance audits (`DB_TEST_POSTGRES=true`). They are optional and are not invoked by the development commands or setup. Feature-specific opt-in integration/e2e helpers may have their own disposable fixtures; they are not part of Run.

## Runtime compatibility

Runtime requires every workspace migration to have a shared record of its SQL hash and every required schema object to keep its verified catalog definition. A widened enum or widened CHECK from another branch replaces the source definition. Other changes on existing tables are not silently accepted.

Additions from other branches are accepted only with their migration records:

- Ordinary tables with their columns, validated constraints and valid indexes, and new enums.
- Nullable or defaulted plain columns on existing tables, including identity columns (they always fill themselves) and nullable generated columns.
- Non-unique indexes; unique indexes or constraints that include a nullable added column, a column filled by identity or `gen_random_uuid()`, or a superset of an existing unique key.
- Foreign keys from an existing table on added nullable columns (`MATCH SIMPLE` skips the check while any referencing column is NULL); CHECKs that cannot fail for the row older writes get: new nullable columns are NULL and the other new columns take their verified defaults.

A foreign key from another branch that restricts deletes from a required table, extra triggers, functions, policies, invalid indexes and unvalidated constraints are blocked. Equal history with unexpected physical objects is drift.

## Coordination and fixed Run ports

Conductor Run uses backend `3000`, frontend `3001`, and Fumadocs `4000`, with matching authentication/CORS/client URLs. The tracked and machine-local Run commands explicitly set `DEV_USE_CONDUCTOR_PORTS=false`. Repository Run remains `nonconcurrent`: one Conductor-managed workspace for this repository uses these fixed ports at a time. The Mac client reads tracked configuration after it reaches the remote default branch; machine-local overrides take effect on this machine.

`bun run dev:parallel` remains an explicit terminal opt-in for allocated workspace ports. It does not change the Conductor Run default. The ordinary terminal launcher only supervises its own children. Conductor Run first checks read-only DB compatibility, then invokes `$HOME/.conductor/scripts/switch-local-dev.zsh --stop-only` when installed. The existing machine-local helper stops recognized Cantiara and Sprite Anvil dev processes occupying the fixed ports; unrelated owners are preserved and block switching. A failed DB precheck does not invoke the helper; Conductor may already have stopped its previous managed Run through `nonconcurrent` mode. The precheck and development launcher announce their read-only compatibility checks before inspection, so initial source/DB verification is visible before the three Turbo dev tasks appear. The existing Turbo task panel is retained. A failed switch blocks the new launch. Without the helper, Run launches normally and port conflicts require owner cleanup. This is an explicit local switch between the two approved projects, not a general process cleanup policy.

An API holds a shared advisory lease for its lifetime; preparation needs the exclusive lease on the same key. APIs using the shared database are stopped before migration: ask owners to Stop their running workspaces, prepare, then restart. While running, the supervisor checks the lease every second. It compares a server-side digest of migration history and catalog at most every 30 seconds, or immediately after a local source change, and re-reads the full catalog only when that digest or the source fingerprint differs from the last verified pass. A full read transfers about 190 KB; repeating it every second exhausted the Neon free-plan data-transfer quota. The supervisor stops only its own child on lost lease, changed required schema or incompatible source edits. Direct production/API launches and out-of-band SQL do not acquire this cooperative development lease.

## Historical schema and limitations

`historical-schema-inventory.json` pins immutable historical SQL hashes and exact catalog residues: legacy columns, indexes, constraints and the two reviewed `NOT VALID` checks. Its introspection statements describe differences to ignore, never repair commands to execute. The default-expression introspection exception is additionally pinned to its exact actual catalog definition so a changed default cannot hide behind it. Drift outside these explicit exceptions fails.

The two reviewed snapshotless historical repairs remain immutable; new migrations require snapshots. Never edit database migration rows, manufacture a baseline, renumber applied artifacts or use `db:push` to conceal conflict. Push remains restricted to an explicitly disposable loopback target.

Catalog checks cover schema definitions, not shared business-data isolation or every PostgreSQL privilege/extension setting. Installed Drizzle introspection differences fail closed for investigation. One shared database cannot accept contradictory changes to the same schema object without reconciliation.

## Testing Decisions

- `migration-expansion.test.ts` covers each accepted and rejected expansion case, SQL-only rules, the baseline boundary, first-line-only contract approval, the committed migrations, CHECK defaults verified against the values older writes receive, identity/nullable-generated column fill and weakened unique index acceptance. `constraint-widening.test.ts` covers CHECK widening, NULL evaluation and default binding.
- `development-history.test.ts` covers hash identity: accepted records from other branches, rebased migrations recognized by SQL hash, changed applied SQL, invalid records and exact-order production history that rejects those same records. `database-preparation.integration.test.ts` (opt-in `DB_TEST_POSTGRES=true`) covers, on disposable PostgreSQL, an older pending migration applied beside another branch's newer record with a foreign key and unique index on its nullable column, no reapplication on a second run, readiness, and a failing migration that rolls back without a record.
- `runtime-compatibility.test.ts` covers other branches' additions, constraints on their new columns, CHECK defaults verified the same way, identity and nullable generated column fill, widened enums and CHECKs, missing requirements, restricting foreign keys, custom defaults, triggers and RLS refusal.
- `shared-schema-policy.test.ts` covers exact pending-plan matching, other branches' additions in the diff, CHECK redefinitions, quoted SQL literals, required-object projection and refusal of arbitrary repair/data-only SQL. `shared-source.test.ts` checks source preparation without PostgreSQL creation or a pre-existing receipt.
- Snapshot reconciliation migrations containing only line comments have no executable schema plan. Tests accept these unchanged artifacts while still rejecting comment-prefixed data writes and quoted comment-like SQL literals; migration identity and hash checks remain mandatory.
- `migration-reconciliation.test.ts` uses real disposable Git repositories to verify newly published PR discovery after refresh, renamed migrations carried by merge commits, standalone byte-preserving renames and published SQL corrections traced to their owning schema ancestry, refusal of SQL copies without that ancestry, whole-commit integration, private/uncommitted HEAD refusal, changed hashes, stale PR heads and main publication. `database-preparation.integration.test.ts` verifies that publication refusal happens before any migration table or application DDL is written, and that no-pending preparation does not require publication. The latter remains an explicit `DB_TEST_POSTGRES=true` disposable audit.
- Existing file/policy tests cover target authorization, production separation, snapshot lineage, immutable history and historical residues. Environment/configuration tests cover fixed Run ports, explicit allocated-port opt-in and Varlock environment isolation.
- `migration-files.test.ts` pins the reviewed SQL hashes and the already-applied background/VFX boundary so merged review migrations cannot re-enter its applied prefix.
- `runtime-source.test.ts` verifies fresh subprocess inspection inherits environment values loaded after Bun startup and repeated checks reload the source. `development-runner.test.ts` verifies unauthorized and unavailable targets cannot start an apparently healthy API and both the Conductor precheck and guarded launcher announce inspection before failing. `conductor-settings.test.ts` keeps Setup DB-independent and executes the Run shell command with controlled processes to verify check/stop/start ordering, DB and switch failures, and operation without the optional helper; the opt-in preparation integration suite covers startup and runtime supervision against PostgreSQL.
- `database-state.integration.test.ts` (opt-in `DB_TEST_POSTGRES=true`) verifies the server-side schema fingerprint is stable, handles a missing migration table and changes with both catalog and migration history. `runtime-inspection-gate.test.ts` covers the digest interval.
- The current-receipt regression in `database-preparation.integration.test.ts` uses disposable PostgreSQL to enforce a runtime query budget, reject live catalog drift and changed migration hashes, and preserve migration-lease refusal. It also verifies that non-runtime catalog verification still performs full introspection.
- Live `db:doctor`, `db:validate`, `db:runtime`, `db:prepare` and `db:ready` are separate evidence. A no-pending preparation is a verified no-op, not evidence that new DDL or data backfills were exercised. Optional replay suites are reported separately when explicitly run.

Same-name CHECK expressions and constraint timing flags are verified independently of Drizzle's diff before a fresh schema proof is written. PostgreSQL's `EXPLAIN` without `ANALYZE` compares source and catalog CHECK expressions with the same column types, preserving normal casts, parentheses and `IN`/`ANY` canonicalization. Deferrable constraints and `NO INHERIT` checks are rejected because the source schema does not declare them. This verification creates no temporary tables or PostgreSQL instances and executes no repair SQL.
