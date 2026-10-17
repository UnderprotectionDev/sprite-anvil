# Implement spec

Rules for `/implement-spec`: all GitHub tickets of one spec, implemented in one Conductor workspace on one integration branch by parallel subagents. The skill defines the sequence; this guide fixes the repository facts it needs. Each section ends with its **Done when**.

## Input

The user supplies the spec path (`docs/specs/<phase>/spec.md`) and the ticket numbers. Conductor has no selected issue in this mode, so the user's list is the scope.

1. Read every ticket with `gh issue view <number> --comments`. Local drafts under `docs/specs/<phase>/issues/` are source material only; the published issue is the record ([issue tracker](issue-tracker.md#read-or-update-an-issue)).
2. Check each ticket carries `ready-for-agent` ([triage labels](triage-labels.md)).
3. Read native blockers with `gh api repos/UnderprotectionDev/sprite-anvil/issues/<number>/dependencies/blocked_by`. A ticket without a native edge may still say `Blocked by: #<number>` in its body; honor both.
4. The **frontier** is the open tickets with no open blocker.
5. When the spec already has delivered work, extend it: read the existing code and follow the spec's `Testing Decisions` seam.
6. Commit the rule files before starting. Subagent worktrees open from `HEAD`, so an uncommitted rule file never reaches them. Start from a clean workspace (`git status --short` is empty).

**Done when** every ticket is read with comments, each has a verified label and blocker list, the frontier is named, and the workspace is clean with rules committed.

## Branch and worktree

- The workspace's current branch is the integration branch. Keep its name; create no branch for it.
- Each implementer works in its own worktree on its own branch, and merges the integration tip into that branch before reporting done.
- The integration branch is checked out in the workspace directory, so the merger performs the merge there.
- A new worktree gets `bun install --frozen-lockfile`. Gitignored `.env` files (`.env`, `apps/server/.env`, `packages/db/.env`, `apps/web/.env`) are absent in it; implementers work without them and leave DB-dependent runs to the workspace.
- Exploration notes go to `.context/` under the workspace's absolute path, so every worktree reads the same files.
- Every implementer follows the [AGENTS.md](../../AGENTS.md) process for its ticket (Orient through Close).

**Done when** `git worktree list` shows one line (the workspace) and the integration branch name is unchanged.

## Database

All workspaces share one development database ([shared development database operations](../development-database.md)). Subagents never connect to it.

- Tickets that touch the schema run one at a time, in dependency order; all other tickets run in parallel.
- A schema ticket's implementer generates the migration SQL and snapshot with `bun run db:generate` as the owning ticket's work, and reviews them. It runs no `db:prepare`, `db:migrate`, `db:push` or `db:ready`.
- After the last ticket merges, the workspace runs the [parallel migration workflow](issue-tracker.md#schema-migrations-across-parallel-issues) once: `db:doctor`, publication of the integration branch through the draft PR, `db:prepare`, affected tests, `db:ready`.
- `db:prepare` needs the complete HEAD published, so the draft PR must exist and be pushed before it runs.

**Done when** `bun run db:ready` passes on the merged integration branch, or the precise blocker is recorded for close-out; no subagent has written to the shared database.

## Pull request

Open the draft PR after the first merge, from the workspace:

`gh pr create --base main --draft`

Do not use Conductor's `Create PR` action: with no selected issue it removes the `Closes` lines.

- Write the title and body with the `pr` skill.
- The body holds one standalone line per ticket: `Closes #<number>`.
- Verify with `gh pr view --json body,closingIssuesReferences`; every ticket number must appear in `closingIssuesReferences`.
- Mark the PR ready (`gh pr ready`) only after close-out checks pass.

**Done when** `closingIssuesReferences` lists every ticket of the run and the PR targets `main`.

## Close-out

Apply [implement-close-out](implement-close-out.md) once for the whole spec, not once per ticket.

- **Ne eklendi:** one sub-heading per ticket.
- **İnceleme:** one `code-review` over the whole integration branch, with `## Standards` and `## Spec`.
- **Nasıl test edilir:** one end-to-end journey across the spec's delivered screens, with the `Veri hazırlığı` records created through the UI.
- Name the DB outcome (`db:ready`) and every check not run.

**Done when** the report has all three sections, each ticket appears under **Ne eklendi**, and the journey covers every ticket with visible behavior.
