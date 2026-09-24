# Issue tracker

GitHub Issues in `UnderprotectionDev/sprite-anvil` is the tracker for published work. Resolve the repository from `git remote` before using `gh` in a different clone. Read and write issue state in GitHub; this repository does not define a Linear mirror.

## Read or update an issue

- For an issue number or URL, read its body, labels, and comments with `gh issue view <number> --comments`; fetch structured fields with `--json` when needed. A bare `#<number>` may refer to a pull request, so check `gh pr view` when the context is unclear.
- Search existing open and closed issues before creating one. [Draft issue files](../specs/) under `docs/specs/<phase>/issues/` are local source material; a `Status: ready-for-agent` line does not prove publication. Once a matching GitHub issue exists, use that issue for tracker state and avoid a duplicate.
- When publishing a draft, preserve its acceptance criteria and blockers, and link its owning `spec.md` and PRD requirement. Use `gh issue create --body-file <file>` for a multiline body. Apply the role from [triage labels](triage-labels.md) after checking the issue is specified enough for that role.
- Keep blockers visible. Prefer GitHub issue dependencies when available; otherwise record `Blocked by: #<number>` in the issue body and recheck the linked issue before claiming work.
- Use `gh issue comment`, `gh issue edit`, and `gh issue close` for authorized tracker changes. Reference GitHub issue numbers as `#<number>` in commits and pull requests.

## Pull requests and closure

A pull request is an implementation artifact, not a new issue intake path. In a Conductor issue workspace, read the matching `.context/attachments/[GITHUB]-<number>.md` attachment when present to recover the issue URL across sessions. If the pull request should close an issue on merge, put a supported reference such as `Closes #<number>` in the actual pull request body and target the default branch. Verify the body and closing link before reporting that closure is configured. A merged pull request without that reference may leave the issue open.

**Done when:** the issue read or write refers to the correct GitHub record, its spec and PRD context are traceable, and any label or blocker matches the current GitHub state.
