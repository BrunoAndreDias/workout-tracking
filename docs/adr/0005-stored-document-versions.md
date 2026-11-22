# Stored documents migrate forward, and a plan that can't is dropped only from old versions

Every stored document carries a version, and loading reads each older version forward instead of rejecting it, keeping the old text under `:migrated:` first.

Workout Plans:
- **1** had a plan's days with no blocks.
- **2** had Training Blocks of any number of days.
- **3** has a Training Split, every block with its days, and a Role on each Planned Exercise. Before 3 there was no Role, and a store can't see the Exercises' names, so the first Exercise of a day is read as the main lift and the rest as isolation, which the user can change.
- **4** drops each block's RIR target per week ([ADR-0004](0004-light-blocks-replace-per-week-rir.md)) and requires a boolean `light`. A block of an older version reads as not light, and its per-week RIR is dropped unread.

A plan of version 1 or 2 whose blocks all have 3 or 4 days becomes that split; the others can't, and are dropped, since their text is kept under `:migrated:`. A plan of version 3 or 4 that doesn't fit its split fails the whole document instead: it was written by code that already knew splits, so a misfit means corruption, not age.

Workout Sessions:
- **1** had a plain-text `notes`, read as written at midday of the session's date.
- **2** has an optional timed `note` on the session and on each of its Exercises.
- **3** marks each set done or not, with an optional RIR, and keeps the target the session suggested. Before 3, a set with reps counted as logged, so it reads as done.

Some optional keys came later without a new version: a Planned Exercise's `weeks` and `since`, and a session's `feel`, `after` and its target's `rirMax` and `light`. Code that predates them drops them on save; issue #8 fixes this.
