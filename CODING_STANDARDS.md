# Coding standards

What a reviewer checks in a diff, beyond what `npm run check` already enforces. Each item is a judgement call that no test or lint can make.

## Stored user data

Code that replaces stored user data (load fallbacks, sync, import, migration) keeps the old copy first with `preserveCopy` (`src/domain/persistence.ts`), and a test covers the order in which browsers or devices start. A new key in a stored document bumps its version, so code that predates the key refuses the document instead of saving it back without the key ([ADR-0006](docs/adr/0006-a-new-stored-key-bumps-the-version.md)).
