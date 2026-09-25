# Issue tracker

GitHub Issues in `UnderprotectionDev/sprite-anvil` is the tracker for published work. Resolve the repository from `git remote` before using `gh` in a different clone. Read and write issue state in GitHub; this repository does not define a Linear mirror.

## Selected issue in a Conductor workspace

At task start, inspect Conductor's selected issue context and any attachment named `.context/attachments/[GITHUB]-<number>.md`, where `<number>` is the issue number. Use the selected issue URL or canonical attachment to identify the issue in this repository; verify the repository against `git remote`. Read that GitHub issue, including comments and labels, with `gh issue view <number> --repo <owner/repository> --comments` before implementing it. A branch name, commit message, spec number, or unrelated issue mention does not establish which issue Conductor selected. If several attachments point to different issues, resolve which one is selected before treating any as the task. If Conductor supplied no selected issue and no canonical attachment identifies one, carry out the request as a general task without inventing an issue number.

## Schema migrations across parallel issues

For a selected issue that changes a table, column, or constraint, include the versioned migration in that issue's work. If a general task changes the schema, follow the same migration steps within that task. Do not generate a migration when the schema is unchanged or defer schema migrations until several issues or a spec are complete.

1. Inspect the current schema and migration directories, `packages/db/drizzle.config.ts`, and the `db:*` scripts in the root and database package manifests. Identify the database targeted by `DATABASE_URL` before any command that writes to it. Generate with `bun run db:generate`, review the generated SQL and snapshot against the intended schema change, and keep both with the owning issue or task.
2. If workspaces share a development database, arrange an exclusive migration application window with the other workspaces. Immediately before applying, read the target database's Drizzle migration record and compare its applied entries with this branch's ordered migration SQL files; also check the snapshots' lineage. The applied entries must match the corresponding prefix of this branch's history by identity and recorded content hash where available, not just by count. If an applied migration is missing or differs on this branch, or the history cannot be verified, stop and reconcile the branches before applying anything. Repeat the check if another workspace has applied a migration.
3. Apply pending migrations in order with `bun run db:migrate` only after the history check. Verify the expected tables, columns, and constraints in the target database and confirm the new migration appears in its applied migration record. A successful command exit alone is insufficient evidence. Record what was verified for the issue or task.
4. Treat migrations already applied to a shared database as permanent history. Before generating or applying the next issue's migration, bring that history into its branch through the normal Git integration path and regenerate its pending migration against the updated history when necessary. Use a disposable local database for early validation when another workspace's migration is still pending. Resolve divergent histories through integration and migration planning; do not rewrite applied migration files or use `db:push` on the shared database to conceal divergence.

## Read or update an issue

- For an issue number or URL, read its body, labels, and comments with `gh issue view <number> --comments`; fetch structured fields with `--json` when needed. A bare `#<number>` may refer to a pull request, so check `gh pr view` when the context is unclear.
- Search existing open and closed issues before creating one. [Draft issue files](../specs/) under `docs/specs/<phase>/issues/` are local source material; a `Status: ready-for-agent` line does not prove publication. Once a matching GitHub issue exists, use that issue for tracker state and avoid a duplicate.
- When publishing a draft, preserve its acceptance criteria and blockers, and link its owning `spec.md` and PRD requirement. Use `gh issue create --body-file <file>` for a multiline body. Apply the role from [triage labels](triage-labels.md) after checking the issue is specified enough for that role.
- Keep blockers visible. Prefer GitHub issue dependencies when available; otherwise record `Blocked by: #<number>` in the issue body and recheck the linked issue before claiming work.
- Use `gh issue comment`, `gh issue edit`, and `gh issue close` for authorized tracker changes. Reference GitHub issue numbers as `#<number>` in commits and pull requests.

## Pull requests and closure

A pull request is an implementation artifact, not a new issue intake path. If the pull request should close an issue on merge, put a supported reference such as `Closes #<number>` in the actual pull request body and target the default branch. Verify the body and closing link before reporting that closure is configured. A merged pull request without that reference may leave the issue open.

**Done when:** the issue read or write refers to the correct GitHub record, its spec and PRD context are traceable, any label or blocker matches the current GitHub state, and any schema change has a verified migration in the same issue or task.
