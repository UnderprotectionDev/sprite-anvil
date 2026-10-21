# Conventions check

`bun run check:conventions` enforces the rules of [structure.md](../../structure.md) and the [tech stack's Responsibilities](../tech-stack.md#responsibilities) that can be read mechanically. Lefthook runs it before every commit and the `Conventions` workflow on every pull request. Its folder lists, names and checks come from those documents, so editing a rule there changes what is enforced; if a passage it reads is gone, the check stops and names it.

## When it fails

Move the code to where the rule puts it. A rule that accepts a reason (an extra feature folder, an `index.ts` barrel, a stack row marked `exception with a reason`) takes a comment in the file, or for a folder in any file directly inside it:

```ts
// conventions-exception: raw-fetch Uploads stream a multipart body to the file endpoint, outside oRPC.
```

The reason says why the rule does not fit. The check prints every exception it accepts, so review sees each one.

## Baseline

`scripts/conventions-baseline.json` lists deviations merged before the check existed; they pass, and they are not examples to copy. The list only shrinks: after fixing one, run `bun run check:conventions --prune`. A new deviation is fixed or given a stated exception; pull requests fail when the baseline grows.

## Judgment

The check never decides whether a capability is a feature, whether a `<name>-core` boundary is earned, whether a route stays thin, or whether an exception's reason holds. Those, and every rule it does not name in its output, stay with the agent and review.
