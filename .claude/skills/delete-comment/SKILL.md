---
name: delete-comment
description: Delete code comments from Treino and lower the comment ratchet. Sorts each comment as Tautology, Stale, Excuse or Decision Record, deletes it, files an issue for each Excuse and moves each Decision Record into an ADR. Use for /delete-comment, "delete comments", "clean up comments", or when the `treino/no-comments` lint rule fires.
---

# Delete comments

Treino code has no comments. The `treino/no-comments` oxlint rule (`lint/no-comments.mjs`) bans them, except lint and TypeScript directives. `lint/comment-baseline.json` lets each older file keep at most the comments it had, and that count only goes down.

## Scope

The user names the scope: a PR (`gh pr diff <n>`), a branch since `main`, a file or a directory. With none given, take the file with the highest count in `lint/comment-baseline.json`. In a PR or branch, the comments in scope are the ones its commits added or changed:

```sh
git blame -l -s <file>   # a comment line whose sha is in `git rev-list main..HEAD` is in scope
```

A comment block is in scope if any of its lines is. Work in a worktree on the target branch, and follow AGENTS.md there.

## Sort each comment

Read the code around each comment, then give it exactly one category:

| Category | It… | Action |
|---|---|---|
| Tautology | repeats what the name, type or code beside it already says | Delete it. |
| Stale | describes code, a field, a version or a behaviour that no longer exists | Delete it. |
| Excuse | explains away a hack: a cast, a skipped version bump, a duplicated rule, a "for now" | Delete it, and file an issue to fix the hack. |
| Decision Record | records a non-obvious choice: a number from research, a trade-off, why the obvious path was not taken | Move it into an ADR, then delete it. |

When a comment mixes categories, split it: the decision goes to an ADR, the excuse to an issue, the rest goes.

If a deleted Tautology leaves the code unclear, the name is wrong. Rename the function, field or constant instead of keeping the comment.

## Decision Records go into ADRs

ADRs live in `docs/adr/`, numbered `0001-slug.md` upwards. A short title stating the decision, then 1–3 sentences: the context, the choice and why. Add **Considered Options** or **Consequences** only when they matter. Group comments about one decision into one ADR, and extend an existing ADR rather than writing a second one on the same decision. Cite `docs/research/` notes where the comment did. If `CONTEXT.md` already says it fully, there's no need for an ADR.

## Excuses become issues

File one issue per hack:

```sh
gh issue create --label ready-for-agent --title "<what to fix>" --body "<problem, what to build, acceptance criteria>"
```

Quote the deleted comment and its file in the problem, and name the standard it breaks (`CODING_STANDARDS.md`, AGENTS.md Rules) when there is one. Mention the issue in the ADR when one covers the same code.

## Finish

1. `npm run comments:ratchet` lowers `lint/comment-baseline.json` to the new counts. It refuses to raise one.
2. `npm run check`.
3. Commit the deletions, ADRs and baseline together: `chore(comments): delete <scope>'s comments`.
4. Report a table: each comment (file:line, first words), its category and what happened, plus the issues filed, the ADRs written and the comments left in the baseline.
