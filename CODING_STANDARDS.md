# Coding standards

What a reviewer checks in a diff, beyond what `npm run check` already enforces. Each item is a judgement call that no test or lint can make.

## Stored user data

Code that replaces stored user data (load fallbacks, sync, import, migration) keeps the old copy first with `preserveCopy` (`src/domain/persistence.ts`), and a test covers the order in which browsers or devices start.
