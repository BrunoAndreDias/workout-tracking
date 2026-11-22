# A refused change waits for a reload, and a crash shows a page that can export

The sync layer sorts every answer to a change into three classes: offline (no answer, a timeout, a 5xx or a reply that is not the expected JSON), conflict (409) and refused (any other 4xx, such as 413 for a body over the server's limit). Offline retries on its own. A refused change is a new sync status, `recusado`: the store stays pending in this browser and is not sent again, by the retry timer, `online`, `visibilitychange` or a later edit, until the next start, which sends it once more. Retrying a request the server refuses only repeats the refusal, and the user's change must not be dropped. Conflict and refused outrank offline, and conflict outranks refused, since its `Recarregar` is the one that resolves it.

When the app fails to start or a render throws, a hand-written root error boundary and a catch on `main.tsx`'s start show `Algo correu mal no Treino.` with `Exportar dados` and `Recarregar`. The export reads the stores straight from localStorage through `exportBackup`, so it works without the app's state and writes the same Backup file.

## Consequences

A store refused for good, such as one too large for the server, says `recusado` at every start until the user exports, trims the data and imports it again. Nothing retries a refused change in the background, so a fixed server takes it only after a reload.
