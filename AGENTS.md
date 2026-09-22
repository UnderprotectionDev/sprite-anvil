# Sprite Anvil agent process

This is the always-loaded process for work in Sprite Anvil. Apply the full sequence to product behavior changes. For maintenance or documentation work, follow only the steps and references the change touches.

## Process

1. **Orient.** Before changing product behavior, name the owning term in [the repository glossary](docs/CONTEXT.md), the requirement ID and file in [the PRD](docs/prd/README.md), the relevant [workflow phase](docs/workflow/), and every affected [ADR](docs/adr/). Record a path for each, or `none` after checking. The PRD defines behavior; a glossary term or workflow phase alone does not establish delivery scope. Surface contradictions with exact paths before implementation.
2. **Name.** Use the glossary's canonical English technical names in code, contracts, and tests; use its paired Turkish product labels in product documentation. Its `_Avoid_` lists are binding.
3. **Stack.** Before changing implementation, map new technical responsibilities to [the tech stack](docs/tech-stack.md), inspect the relevant package configuration, and read the nearest working code example. State the selected stack entry and example path or `none`. Bring missing or conflicting choices to the user before introducing a dependency or a new platform boundary.
4. **Change.** Implement the owning PRD behavior within the affected ADR boundaries. Use workflow phases for work breakdown and completion criteria, and [acceptance scenarios](docs/prd/10-acceptance-scenarios.md) for applicable test evidence. Add focused tests for changed behavior and failure paths at the appropriate seam. If the requirement does not settle a consequential product choice, resolve it with the user rather than inventing behavior.
5. **Close.** Recheck the Orient paths, chosen names, stack mapping, tests, generated files, and any in-file instructions. Run relevant checks and report delivered behavior, actual verification, and remaining limitations using [the close-out guide](docs/agents/implement-close-out.md). A review or commit is required only when the task calls for it.

## Conditional references

- **Domain documents:** Before changing `docs/CONTEXT.md` or an ADR, or when a needed term is missing, read [domain guidance](docs/agents/domain.md). Preserve the distinction between this repository's glossary and an in-product project's `context.md`.
- **Authentication and private project data:** Read the applicable requirements in [platform and operations](docs/prd/08-platform-and-operations.md) and the relevant privacy or permission [workflow phase](docs/workflow/). For Better Auth sessions, cookies, or account access, check the installed version's API and security guidance; test unauthorized, expired, and failed paths that the change affects.
- **User-facing changes:** Follow [the close-out guide](docs/agents/implement-close-out.md) to give a usable manual check with real screens, controls, setup, and expected results. For a change without a visible flow, state that explicitly.

## Repository guardrails

- **Generated output:** Edit the source and regenerate. TanStack Router creates `apps/web/src/routeTree.gen.ts`; Varlock generates `src/env.ts` from each owning `.env.schema`. Better Auth schema generation is available through `bun run auth:generate`; inspect its output before accepting it.
- **Database schema:** Drizzle Kit reads `packages/db/src/schema/` and writes versioned SQL to `packages/db/src/migrations/`. Review the SQL produced by `bun run db:generate` before applying it with `bun run db:migrate`. Inspect the target database before using the separate `db:push` script.
- **Code quality:** Use [package scripts](package.json) and [Biome configuration](biome.json) for Ultracite formatting and checks. Keep controls semantic and keyboard accessible, validate external input at its boundary, use descriptive errors, and make new modules focused with direct imports rather than catch-all barrel exports.
