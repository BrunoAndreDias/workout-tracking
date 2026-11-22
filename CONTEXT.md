# Workout Tracking

This context describes how one person plans their training and logs what they trained: Workout Plans of Training Blocks, the sets of each Workout Session, how a session felt then and on the days after, and the Material each Exercise needs.

## Language

**Exercise** (Exercício):
A named movement the user trains, such as "Flat Barbell Bench Press". The app ships a catalog of exercises with English names, each with its muscle group, movement pattern and whether it is a compound or an isolation movement (ported from just-workout); it is not stored. Each catalog Exercise also says where it is felt, on parts of the body finer than its muscle group, such as the side of the shoulder for a lateral raise: the parts it targets (Alvo, where the user should feel it) and the parts that help (Apoio). The exercise picker shows them on a body map, front and back; an Exercise of the user's own has none. The user picks an Exercise from the catalog, or types a name of their own, such as "Supino". Picking or typing a name the user already has, ignoring case, is that Exercise; any other name creates one. An Exercise may need Material, and then it needs every piece listed.
_Avoid_: Movement, lift; primary muscle for Alvo (a primary muscle is the muscle group a set counts for)

**Material** (Equipment):
What an Exercise is done with, such as a Barra, Halteres or a Banco plano: a fixed list the app ships, in Portuguese, plus material the user adds and names, such as Elásticos. Every catalog Exercise comes with the app's guess of the Material it needs; an Exercise of the user's own needs none until the user says so. The user corrects any Exercise's Material on Treino → Material, which marks it Alterado until they tap Repor, so over time the list says what each Exercise really asks for. Material never blocks an Exercise: it only orders and flags suggestions.
_Avoid_: Equipment in the UI, gear, kit

**Local** (Gym):
A place the user trains, such as Ginásio or Casa, and the Material it has. The user may keep several and one is active. In the exercise picker, what the active Local has every Material for lists first, and the rest shows with `Falta: <material>` and stays pickable; a Planned Exercise shows the same line. With no Local, nothing is flagged.
_Avoid_: Gym in the UI, location

**Dictation** (Ditado):
Speaking a note instead of typing it. The mic button on a note field records until tapped again, and the transcribed text is appended to the note. The user's voice is transcribed on the device by the Whisper small speech model, which is downloaded once (about 250 MB) the first time the user dictates. No audio leaves the device. Every note can be dictated: Exercise Notes, After-effects and the Workout Session's note.
_Avoid_: Voice note (that would be a stored recording; none is kept), voice input

**Workout Plan** (Plano de treino):
A named training program of one Training Split, made of Training Blocks. It starts from the split's template, every day filled with catalog Exercises, and the user swaps, adds and removes them. The user may keep several and one is active: the days of its current block are the ones a Workout Session can start from, and the day after the last one trained, by its place in the block, comes first. Plans written before Training Splits were kept as their split when every block had 3 or 4 days, the first Exercise of each day as its main lift and the rest as isolation work; any other plan was dropped, and its stored text kept aside.
_Avoid_: Program, routine

**Training Split** (Divisão):
How a Workout Plan spreads the body over its days, one of two: 3 days, Push, Pull and Full body, or 4 days, Upper A, Lower A, Upper B and Lower B. Every block of a plan has its split's days, so days are never added, removed or renamed.
_Avoid_: Program, template (that is how a split's days start)

**Training Block** (Bloco):
One stage of a Workout Plan's cycle, such as "Bloco A", with its own Workout Days, a length in training weeks (1 to 52, 6 by default, inside the 4 to 8 weeks between deloads that `docs/research/block-length-and-progression.md` finds) and whether it is light ("Semana leve"). A light block, such as a deload, moves every Role's RIR Target 2 further from failure. A training week is a calendar week, Monday to Sunday, holding a Workout Session with a done set, of any plan or none, so a week without training pauses the block instead of skipping it. The user starts the cycle on a block with "Começar aqui", which counts from the week it is tapped; until then the plan has no current week and sessions start from its first block. Each training week since that week moves the cycle on one week, into the next block once a block's weeks are done, and back to the first after the last block. The week of a date is the training week after those before it, whether or not it holds a session yet. On a block's first week the app switches to its days by itself and says which Exercises come in and which go, compared with the block before. A new block starts as a copy of the selected one, light or not; a deload is a short light block. Removing a block keeps the sessions logged from its days, which then read "Dia de treino eliminado". The plan shows the selected block's planned sets a week for each muscle group, counting each day once and every set for each primary muscle of its catalog Exercise: on a body shaded by sets, beside the groups ranked most sets first, with the days that train each; an untrained group shows as a gap, and the user's own Exercises, which have no muscle group, are listed apart. Each group is placed against the Reference Range, and notes point at untrained groups, groups outside it and uneven pairs (chest and back, quads and hamstrings, biceps and triceps), for information only.
_Avoid_: Mesocycle, phase, cycle (that is the order of the blocks), program

**Reference Range** (Intervalo de referência):
10 to 20 sets a week for a muscle group, a common range for growth. The plan shows each group's weekly sets against it as below, within or above, and never holds the user to it: it only informs.
_Avoid_: Target, goal, minimum (nothing is required)

**Workout Day** (Dia de treino):
One day of a Training Block, named by its Training Split, such as "Push", holding its Planned Exercises in order. Beside them the plan shows each muscle group its catalog Exercises train, with that day's planned sets, counting every set for each primary muscle. An Exercise appears at most once in a day. Each day's id is unique across every block of every plan, so a session always finds the day it started from.
_Avoid_: Workout template

**Planned Exercise**:
An Exercise in a Workout Day with its role, number of sets, a rep range, such as 3 × 8–12, and its Exercise Run's length. A single target is a range whose minimum and maximum are equal. Swapping it for another Exercise keeps its role, sets, reps, weeks and place, and starts a new run.

**Exercise Run** (semanas do exercício):
How long an Exercise stays in its place before the app asks to review it: a length in training weeks, 1 to 52, or no limit, counted from the date it was added or swapped in, or the plan was created. Main lifts (Principal) have no limit by default and every other role 8 weeks, since an accessory keeps giving gains for 8 to 10 weeks and then rotates; changing the role does not change it. The weeks count as a Training Block's do, calendar weeks holding a Workout Session with a done set, so a week without training pauses the run, and the week of a date is "semana N de M". A Planned Exercise from before runs counts from the week it was first done. A copied block carries its runs on. An Exercise on several days of a block is one run, as long as its longest there and due at its shortest limit. Once a run of the active plan's current block is done, Treino → Registo lists it under "Exercícios a rever" with two ways out: "Trocar", for another Exercise (the same movement lists first, so the same muscle at another angle), on every day it is planned, or "Mais 4 semanas", four more weeks from now. The plan's row reads "Rever: N semanas feitas".
_Avoid_: Rotation, expiry

**Role** (Função):
What a Planned Exercise does in its day: Principal (the main lift, 6–8 reps), Secundário (8–10), Isolamento (10–15) or Abs (10–15), each 3 sets by default. Each Role has its RIR Target. An Exercise added by hand starts as Abs for core work, Secundário for a catalog compound and Isolamento otherwise.

**RIR Target** (alvo de RIR):
How many reps in reserve a set aims to finish with, about 80% of the reps it could do: 2 for Principal and Secundário, 1 to 3 for Isolamento and Abs (`docs/research/rir-and-volume.md`), each 2 more in a light Training Block. A recommendation the session shows on its RIR chips, never a limit: any RIR can be logged.
_Avoid_: Effort target, RPE

**Suggested Target** (alvo sugerido):
The kg and reps a Workout Session started from a day fills into each set of an Exercise, by double progression from the done sets of the latest earlier session that has any, at its last set's load. Each such set's logged RIR is read against the RIR Target it aimed at (a session that kept none, from before RIR Targets, against its Role's, never a light one): inside it, or none logged, gives one more rep; above it (easy) two more; below it but short of failure the same reps; failure (RIR 0) one fewer, all at the same load. The hardest set, the one giving the fewest reps, decides, and every set gets the same kg × reps; the number of sets is always the plan's. When the next RIR Target differs from the one the sets aimed at, such as into or out of a light Training Block, the reps shift by the difference between their lower ends, and they never rise more than 2 over the lowest done reps. Past the top of the rep range the load goes up one step, below the bottom down one, never more than one step a session: 1 kg under 25 kg and 2,5 kg from 25 kg, within ACSM's 2–10% (`docs/research/progression-rate.md`). The reps at the new load are re-estimated with Epley, aiming at the next target's lower end, and kept in the range. A bodyweight Exercise moves its reps only, within the range. The session keeps the target, with the RIR Target it aimed at, and says why, naming the hardest set's RIR (none when it had none logged), the target and what decided: "Última: 60 kg × 8 · RIR 1, alvo 2. Mais duro do que o alvo: mantém 60 kg × 8." A change of target is named too: "Semana leve: alvo RIR 4." into a light block, "Volta ao alvo RIR 2." out of one, and "Novo alvo: RIR 2." for any other, such as an older session's single RIR.

**Workout Session** (Treino):
What was trained on one calendar date (`YYYY-MM-DD`, the user's local day). It starts from a Workout Day of the active plan's current Training Block or blank, and then keeps its own copy, so editing the plan later never changes it. Starting from a day gives one row per Planned Exercise with the planned number of sets, each pending at its Suggested Target, or empty when the Exercise was never done. One tap marks a set done as it stands. An Exercise appears at most once in a session. A session also has free-text notes: one Timed Note about the workout as a whole, and an Exercise Note for each of its Exercises. The session names the muscle groups its done sets trained, with their sets. At its end the user may rate how it felt ("No fim do treino") on five words, Muito mal, Mal, Normal, Bem and Muito bem (1 to 5), and on the following days write its After-effects. A date may hold more than one session.
_Avoid_: Workout (as a type name), training log

**Logged Set**:
One set of a Workout Session: the load in kg, or no load for a bodyweight set, the reps, an optional reps in reserve (RIR, 0 to 5 or more), and whether it is done. Only a done set counts, everywhere: in the session's counts, the training weeks, the muscle groups trained and the next Suggested Target. A set becomes done only by the user's tap, and only with reps; typing kg or reps never marks it. A set stays pending until then, kept with what was suggested or typed. Picking a RIR also fills the next pending set that has none. Sets logged before done sets existed count as done when they have reps.
_Avoid_: Rep set, entry; "filled" for done

**Exercise Note** (Nota):
A Timed Note on one Exercise of one Workout Session, for pain, discomfort or anything else about how that Exercise went. Starting a session never copies one.

**After-effect** (Depois do treino):
A Timed Note about how a Workout Session feels on a later date: soreness, pain or recovery that shows a day or two after training. It is about the session as a whole or about one of its Exercises, and a session has at most one per date and Exercise. It is written on Treino → Registo, in the "Treinos anteriores" card of the date it is felt, which lists each session from one to three days before that date. The session's own card lists its After-effects read only by day ("Dia seguinte", "2 dias depois"), so an injury can be followed across days. Removing an Exercise from the session removes its After-effects.
_Avoid_: Injury log, pain entry, follow-up

**Timed Note**:
A free-text note that records when it was written, so a later look at it knows as much as possible: when it first held text and when its text last changed, as local date and time to the second. A note cleared to blank is removed, times and all. The app shows the times under the note, as "Escrito a 6 out, 18:50 · editado 19:02", leaving out the edit within the same minute and repeating the date when the edit was on another day. Exercise Notes, After-effects and a Workout Session's note are Timed Notes. A session note from before Timed Notes counts as written at midday of the session's date.

**Store**:
One document the app keeps under its own key, such as the Workout Sessions or the Material, in the same versioned JSON in localStorage, in a Backup and on the server. The server's database is the copy that counts: it keeps each Store as opaque text with a revision number and never reads its contents. A browser's localStorage is its working copy, refreshed from the server each time the app opens. A change made in one browser that reaches the server after another device changed the same Store is a conflict, and the app then offers to reload the server's copy.
_Avoid_: Table, collection

**Backup**:
One JSON file holding every store the app keeps, and still the one portable copy of the data: Exercises, Workout Plans, Workout Sessions and Material (the Locais, the user's own Material and their corrections), each in the form the app saves it. Importing either merges it in or replaces everything. The Apple Watch values and workouts of a Backup from an older version of this app are ignored. A Backup from the meal-planning app is rejected like any other file that is not this app's. A Workout Plan in a file from before Training Splits that fits no split is dropped from the import, not a reason to reject the file. A merge adds the Exercises, Workout Plans and Workout Sessions the user does not already have, by id (a session brings its end feel and After-effects with it). Locais and the user's own Material are added by id, and a Material correction only for an Exercise the user has not corrected; the active Local stays, or becomes the file's when the user has none. An incoming Exercise named like one the user has, ignoring case, becomes that one, in its sets and its After-effects alike. A file that is invalid in any store the app keeps is rejected whole and changes nothing.
_Avoid_: Sync, export (as a noun)
