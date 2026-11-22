# Theme

A button at the end of the `Treino` tab row (`Registo`, `Plano de treino`, `Material`) switches between the light and dark themes. The choice is remembered in the browser. Without a stored choice, the app follows the system colour scheme.

## Sub-features

- `theme-toggle` switches `document.documentElement.dataset.theme` between `light` and `dark`. The button's name says the theme it will switch to: `Mudar para modo escuro` in light, `Mudar para modo claro` in dark.
- `theme-persist` keeps the choice in `localStorage['workout-tracking:theme']` across reloads.

## How to get to it (user POV)

- The icon button (☾ in light, ☀ in dark) at the end of the `Treino` tab row (there is no header).

## Driving it with session.mjs

Preconditions:

- Fresh context. Playwright's default colour scheme is light, so the button reads `Mudar para modo escuro`.

- **Toggle.** Click `Mudar para modo escuro`. `page.evaluate(() => document.documentElement.dataset.theme)` is `'dark'`, and a button `Mudar para modo claro` exists.
- **Persist.** `page.evaluate(() => localStorage.getItem('workout-tracking:theme'))` is `'dark'`. After `page.reload()`, the theme is still `dark`.
- **Back.** Click `Mudar para modo claro`. The theme is `light`.
- **Proof.** Capture `app.shot('dark')` in dark mode.

## Gotchas

- `app.stored()` reads only the four data stores, not the theme key. Read the key with `page.evaluate`.
- A layout or colour change should be checked in both themes. Toggle through the button rather than setting `data-theme` by hand.
