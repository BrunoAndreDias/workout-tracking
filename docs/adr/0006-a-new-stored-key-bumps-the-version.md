# A new stored key bumps the version, and a refused document stays in place

A new key in a stored document bumps its version, so code that predates the key refuses the document instead of saving it back without the key. A refused document is kept under `:unreadable:`, and the app's start-up save leaves it in place until the user changes that store.

## Consequences

Builds before this rule save an empty store over a document they refuse. None can start on one now: there is no service worker and `index.html` isn't cached, so every start loads the current build.
