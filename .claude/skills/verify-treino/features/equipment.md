# Material (Treino → Material)

The third tab of the `Treino` view holds what the user trains with. A Local (Gym), such as `Casa`, lists the material it has; one Local is active. Each Exercise needs some material: catalog Exercises come with the app's guess, the user's own need none, and the user corrects either. The exercise picker and the planned Exercises then judge each Exercise against the active Local: what it has everything for lists first, and the rest is flagged `Falta: …` but stays pickable. With no Local nothing is flagged.

## Sub-features

- `equipment-gyms` is the region `Locais`: the group `Local ativo` of `.filter-chip`s, one per Local, the active one `aria-pressed="true"`; the textbox `Nome do novo local` and `Adicionar local` (also Enter), which adds a Local with no material and makes it active.
- `equipment-has` is the active Local's fieldset: its name as `Nome do local: <name>. Clique para renomear`, `<n> de <total>`, `Marcar tudo` (every built-in and own material), `Limpar`, `Remover local` (after a confirm; the active one passes to another Local, or none), and the list `Material em <local>` of checkboxes named by material, 28 built in (`Barra`, `Halteres`, `Banco plano`, `Banco ajustável`, `Suporte de barra (rack)`, …) then the user's own.
- `equipment-own` is the region `O teu material`: one `.own-row` per material the user added, renamed through `Nome do material: <name>. Clique para renomear`, `Remover <name>` (after a confirm; it also leaves every Local and every Exercise), and `Novo material` with `Adicionar material`. A name another material has, ignoring case, is not added.
- `equipment-exercises` is the region `Exercícios`: the search `Pesquisar exercício` (looks through every Exercise), and the group `Mostrar` of chips `Alterados`, `Os teus` (only when the user has Exercises of their own) and the muscle groups; it opens on `Peito`. Each `.equipment-exercise` has `.result-name`, its group (or `Criado por ti`), the list `Material de <exercise>` of `.need-chip` buttons `Tirar <material> de <exercise>` (`.lacking` when the active Local lacks it) or `Sem material`, the select `Juntar material a <exercise>`, and `Falta: …` under it when the active Local lacks some.
- `equipment-correct` is a removed or added material: the row shows `.changed-tag` `Alterado` and `Repor o material de <exercise>` (text `Repor`), which goes back to the guess. Editing back to the guess also drops `Alterado`.
- `equipment-picker` is the exercise picker's part (see [picker](./picker.md) `workout-picker`): each `.result-sub` reads `<group> · <material>` (`Sem material` for none). With an active Local, each section lists the Exercises it has everything for first; the others are `.result.is-missing` with a `.missing-line` `Falta: <material>, …`, still enabled. With 2+ Locais the head has the group `Local` of chips that switch the active one. With none, a muted hint says `Marca o material que tens em Treino → Material, …`.
- `equipment-planned` is a `.missing-line` `Falta: …` under a Planned Exercise's name in `Plano de treino` when the active Local lacks material for it.

## How to get to it (user POV)

- `Treino` → the tab `Material` in the `nav` named `Treino`.
- The picker from `Exercício` or ⇄ in `Plano de treino`, `Exercício` in a session on `Registo`, or `Trocar` in `Exercícios a rever`.

## Driving it with session.mjs

Preconditions: a fresh `openApp`. Material sits under `Treino`; nothing else is needed. For the picker, `app.workoutTab('Plano de treino')` and create a Workout Plan with `createWorkoutPlan(page, { days: 3 })` from `e2e/_driver.mjs`.

- **Open.** `openWorkoutTab(page, 'Material')` from `e2e/_driver.mjs`.
- **Add a Local.** `addGym(page, 'Casa', ['Halteres', 'Banco plano'])` from `e2e/_driver.mjs`: the group `Local ativo` has `Casa` pressed, and `getByRole('list', { name: 'Material em Casa' }).getByRole('checkbox', { checked: true })` counts 2.
- **Picker flags.** On `Plano de treino`, `Push` → `Exercício`, search `curl`: `Standing Dumbbell Curls` lists before `Standing Barbell Curls`, which is `.is-missing` with `Falta: Barra`. On Push's card (not in the picker, where it reads `Já adicionado`), the Planned Exercise `Flat Barbell Bench Press` shows `Falta: Barra, Suporte de barra (rack)`.
- **Correct.** In `Exercícios`, search the Exercise, click `Tirar Barra de Standing Barbell Curls`, then `selectOption({ label: 'Halteres' })` on `Juntar material a Standing Barbell Curls`: `Alterado` shows, and the picker no longer flags it. `app.stored().equipment.needs` is `{ 'standing barbell curls': ['dumbbells'] }`.
- **Reset.** `Repor o material de Standing Barbell Curls`: `Alterado` is gone and the flag is back.
- **Switch.** A second Local with `Marcar tudo`, then in the picker the group `Local` → `Casa` flags again.
- `e2e/equipment.mjs` is the full recipe, with a reload and a 375 px check.

## Gotchas

- The store is `workout-tracking:equipment` (`app.stored().equipment`): `{ version: 1, custom, gyms, activeGymId, needs }`. `needs` is keyed by the Exercise's lower-cased name and holds only corrections.
- Material ids are English (`barbell`, `dumbbells`); the user's own are `mat:<uuid>`. Labels on screen are Portuguese.
- A flagged Exercise is never disabled; only one already in the day or session is.
- The checklist is the active Local's: picking another chip in `Local ativo` changes both which Local the list shows and what the picker judges by.
