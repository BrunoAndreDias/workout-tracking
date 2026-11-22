# kg has two decimals, shown trimmed, and typing more rounds them

A load in kg keeps up to two decimals and shows them trimmed, with a comma, in pt-PT: `60`, `62,5`, `61,25`. A kg field takes a comma or a point, and more than two decimals are rounded to two (`61,257` saves 61.26 and the field then shows `61,26`), not refused. One module, `src/domain/numbers.ts`, writes and reads numbers for the fields and the Suggested Target's reason line, so the two can't disagree (decided on issue #10).

Two decimals cover every load the app makes or a gym has: the progression maths already rounds to two (60 + 2,5 steps, 63,75 after a 61,25 start), and 1,25 kg add-ons and microplates give loads like 61,25. One decimal showed 61,25 as `61,3` while the reason line said `61,25 kg`.

## Considered Options

- **One decimal.** Rejected: it can't show 61,25 or 63,75, which the app itself suggests.
- **Refusing more than two decimals.** Rejected: a typo like `61,257` would leave the field uncommitted with no reason given; rounding keeps what was meant.

## Consequences

Rounding applies to typed kg only. Stored documents keep reading any non-negative kg, so a set saved with more decimals before this still loads ([ADR-0005](0005-stored-document-versions.md)), shows rounded to two, and is stored rounded only when the user types over it. No stored key changed, so no version bump ([ADR-0006](0006-a-new-stored-key-bumps-the-version.md)).

The muscle-volume ratio (`1,5× as séries`) is not a load and keeps one decimal.
