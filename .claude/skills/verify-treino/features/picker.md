# Exercise picker (Adicionar exercício)

The panel the user picks an Exercise from, under a Workout Day in `Plano de treino`, in a session on `Registo`, or to swap one (⇄). It searches the catalog (English names, ported from just-workout) and the user's own Exercises, filters by muscle group, and creates a new Exercise from a name it does not know. Each catalog row has a small body figure; tapping it shows, inside the panel, where that Exercise should be felt: the parts it targets (`Alvo`) and the ones that help (`Apoio`), on a front and a back figure, finer than its muscle group (the side of the shoulder for a lateral raise).

## Sub-features

- `workout-picker` is the dialog `Adicionar exercício` (from `Exercício` under a day or in a session) or `Trocar exercício` (from ⇄, with a `.swap-card` `A trocar <exercise>`). It has the search `Pesquisar exercício` (every word must be in the name; Enter picks the first row that is not taken, or creates the query when none is pickable), the group `Grupos musculares` of `.filter-chip`s (any chip but `Todos` hides `Os teus`; `Todos`, `Peito`, `Costas`, `Ombros`, `Quadríceps`, `Posteriores`, `Bíceps`, `Tríceps`, `Antebraços`, `Abdominais`, `Glúteos`, `Gémeos`), then the regions `Mesmo movimento` (swapping a catalog Exercise: the others of its movement pattern), `Os teus` (the user's Exercises that are not in the catalog) and `Catálogo` (its visible heading is `<n> exercícios`, or `Outros` when `Mesmo movimento` shows, so find it by role, not by text). Each is a `.pick-row`: a catalog Exercise's starts with the button `Ver músculos de <exercise>` (`.muscles-btn`, a `.bm-thumb` figure of the side that shows most of its target, lit; half faded when taken), which opens `workout-muscle-map`; the user's own has an empty `span.muscles-btn` so the names line up. Then the `.result` button, `.result-name` and a `.result-sub` `<muscle group> · <material>` (`Criado por ti · …` for the user's own; material per [equipment](./equipment.md)); one already in the day or session is disabled and reads `Já adicionado`. With a query that is not exactly an Exercise's name, `+ Criar “<query>”` adds it by that name, even while other rows match (`incline` lists the incline presses and offers `+ Criar “incline”`). No row matches: `Nada encontrado para “<query>”.` One tap on `.result` picks and closes. An added Exercise starts as Abs for core work, Secundário for a catalog compound and Isolamento otherwise; a swap keeps the role, sets, reps and place.
- `workout-muscle-map` is the detail `Ver músculos de <exercise>` opens in the same dialog, now named after the Exercise (eyebrow `Músculos trabalhados`), with `Voltar à lista` (`.md-back`, focused) under the title. The body (`.muscle-detail`) has `.md-sub` `<muscle group> · <material>`, `.missing-line` `Falta: …` when the active Local lacks material, then `.md-map`: two `figure.md-figure`s captioned `Frente` and `Costas`, each an `img` (`.bm-figure`) named for what it lights, `Frente: alvo Peito (parte de cima); apoio Ombro (frente), Peito` (`<side>: nada trabalhado deste lado` when none). Worked regions are `.bm-region[data-inv="target"]` (accent) or `[data-inv="assist"]` (pale accent); the rest are idle. Under them `.md-readout` reads `Toca ou aponta um músculo para ver o nome.` until a region is hovered or tapped, on the figure or as a pill, then `.md-readout-name` the region and `.md-readout-inv` `Alvo: onde deves sentir` or `Apoio: também trabalham`; the other regions dim and the region gets a `.bm-ring`. Then the regions `Alvo` and `Apoio` (`.md-group`, heading `.md-group-title` with `.md-group-hint` `onde deves sentir` / `também trabalham`; `Apoio` absent when nothing assists) of `.md-region` pill buttons named by region, `aria-pressed` once tapped (tapping it again, or the figure's background, clears it), in the order `Trapézio`, `Ombro (frente)`, `Ombro (lado)`, `Ombro (trás)`, `Peito (parte de cima)`, `Peito`, `Meio das costas`, `Dorsais`, `Bíceps`, `Tríceps`, `Antebraços`, `Abdominais`, `Oblíquos`, `Lombar`, `Glúteos`, `Quadríceps`, `Adutores`, `Posteriores da coxa`, `Gémeos`. The foot's `.md-pick` `Escolher` picks it and closes; on a taken Exercise it is disabled and reads `Já adicionado`. Escape or `Voltar à lista` goes back to the list with the query, filter and scroll kept and focus on that row's `Ver músculos` button; Escape there closes the dialog.

## How to get to it (user POV)

- `Exercício` under a day's card in `Plano de treino`, or in a started session on `Registo`.
- `Trocar <exercise>` (⇄) on a Planned Exercise, or `Trocar` in `Exercícios a rever`.
- In the open picker, `Ver músculos de <exercise>` on a catalog row.

## Driving it with session.mjs

Preconditions:

- Fresh context, `app.workoutTab('Plano de treino')`, `createWorkoutPlan(page, { days: 3 })` and `const push = await workoutDay(page, 'Push')` from `e2e/_driver.mjs`. `pickExercise(page, name)` picks in an open picker.

- **Rows.** `addExercise(push, 'Supino')`, then open `Exercício`: every `.result-name` under `Catálogo` (114) has its `Ver músculos de <name>`; `Os teus` lists `Supino` with none. Push's own Exercises read `Já adicionado`.
- **Detail.** Fill `incline`, click `Ver músculos de Incline Barbell Bench Press`: `getByRole('dialog', { name: 'Incline Barbell Bench Press' })`; `Alvo` lists `Peito (parte de cima)`, `Apoio` `Ombro (frente)`, `Peito`, `Tríceps`; the `img` `Costas: apoio Tríceps`. Hover the pill `Tríceps`: `.md-readout` reads `TrícepsApoio: também trabalham`. `Dumbbell Lateral Raises` is `Alvo` `Ombro (lado)`, `Apoio` `Trapézio`.
- **Back and pick.** Escape: the dialog is `Adicionar exercício` again, the search still `incline`. Reopen the detail, `Escolher`: Push's `.planned-name`s end with `Incline Barbell Bench Press`, and its detail now has a disabled `Já adicionado`.
- **Phone.** `{ mobile: true }`: the detail is full screen with no horizontal scroll, and the pills are 44 px high.
- `e2e/muscle-map.mjs` drives all of this.

## Gotchas

- The detail fades in and its regions light up over about 0.6 s; wait until `document.getAnimations()` has none running before a screenshot, or it catches a blank or half-lit frame.
- Each figure draws its left half and mirrors it, so a region's `.bm-region` is in the DOM twice per side; use `.first()`.
- `.md-readout`'s text joins the name and the line with no space; compare `.md-readout-name` and `.md-readout-inv` apart when that matters.
- Only catalog Exercises have a map. A name the user typed has no `Ver músculos` button, even when it means the same movement.
