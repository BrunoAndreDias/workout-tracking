# Workout Tracking

This context describes how one person plans their training and logs what they trained: Workout Plans of Training Blocks, the sets of each Workout Session, how a session felt then and on the days after, the Material each Exercise needs, and the daily metrics and workouts of their Apple Watch.

## Language

**Exercise** (Exercício):
A named movement the user trains, such as "Flat Barbell Bench Press". The app ships a catalog of exercises with English names, each with its muscle group, movement pattern and whether it is a compound or an isolation movement (ported from just-workout); it is not stored. The user picks an Exercise from the catalog, or types a name of their own, such as "Supino". Picking or typing a name the user already has, ignoring case, is that Exercise; any other name creates one. An Exercise may need Material, and then it needs every piece listed.
_Avoid_: Movement, lift

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
One stage of a Workout Plan's cycle, such as "Bloco A", with its own Workout Days, a length in training weeks (1 to 52, 6 by default) and an optional reps-in-reserve target (RIR) for each week, such as 5–6 in week 1. A new plan's first block runs 6 weeks from 4–5 RIR down to 0–1. A training week is a calendar week, Monday to Sunday, holding a Workout Session with a done set, of any plan or none, so a week without training pauses the block instead of skipping it. The user starts the cycle on a block with "Começar aqui", which counts from the week it is tapped; until then the plan has no current week and sessions start from its first block. Each training week since that week moves the cycle on one week, into the next block once a block's weeks are done, and back to the first after the last block. The week of a date is the training week after those before it, whether or not it holds a session yet. On a block's first week the app switches to its days by itself and says which Exercises come in and which go, compared with the block before. A new block starts as a copy of the selected one; a deload is just a short block the user writes. Removing a block keeps the sessions logged from its days, which then read "Dia de treino eliminado". The plan shows the selected block's planned sets a week for each muscle group, counting each day once and every set for each primary muscle of its catalog Exercise, with the days that train it; an untrained group shows as a gap, and the user's own Exercises, which have no muscle group, are listed apart.
_Avoid_: Mesocycle, phase, cycle (that is the order of the blocks), program

**Workout Day** (Dia de treino):
One day of a Training Block, named by its Training Split, such as "Push", holding its Planned Exercises in order. Beside them the plan shows each muscle group its catalog Exercises train, with that day's planned sets, counting every set for each primary muscle. An Exercise appears at most once in a day. Each day's id is unique across every block of every plan, so a session always finds the day it started from.
_Avoid_: Workout template

**Planned Exercise**:
An Exercise in a Workout Day with its role, number of sets, a rep range, such as 3 × 8–12, and its Exercise Run's length. A single target is a range whose minimum and maximum are equal. Swapping it for another Exercise keeps its role, sets, reps, weeks and place, and starts a new run.

**Exercise Run** (semanas do exercício):
How long an Exercise stays in its place before the app asks to review it: a length in training weeks, 1 to 52, or no limit, counted from the date it was added or swapped in, or the plan was created. Main lifts (Principal) have no limit by default and every other role 8 weeks, since an accessory keeps giving gains for 8 to 10 weeks and then rotates; changing the role does not change it. The weeks count as a Training Block's do, calendar weeks holding a Workout Session with a done set, so a week without training pauses the run, and the week of a date is "semana N de M". A Planned Exercise from before runs counts from the week it was first done. A copied block carries its runs on. An Exercise on several days of a block is one run, as long as its longest there and due at its shortest limit. Once a run of the active plan's current block is done, Treino → Registo lists it under "Exercícios a rever" with two ways out: "Trocar", for another Exercise (the same movement lists first, so the same muscle at another angle), on every day it is planned, or "Mais 4 semanas", four more weeks from now. The plan's row reads "Rever: N semanas feitas".
_Avoid_: Rotation, expiry

**Role** (Função):
What a Planned Exercise does in its day: Principal (the main lift, 6–8 reps), Secundário (8–10), Isolamento (10–15) or Abs (10–15), each 3 sets by default. Compounds (Principal and Secundário) never aim closer to failure than 1 rep in reserve. An Exercise added by hand starts as Abs for core work, Secundário for a catalog compound and Isolamento otherwise.

**Suggested Target** (alvo sugerido):
The kg and reps a Workout Session started from a day fills into each set of an Exercise, by double progression from the done sets of the latest earlier session that has any, at its last set's load. Each such set could have done its reps plus its reps in reserve (the RIR it aimed at when none was logged); the target reps are that minus the week's RIR target, one more when the target did not change and no set was harder than planned. Past the top of the rep range the load goes up 2,5 kg, below the bottom it goes down, and the reps are re-estimated at the new load; a bodyweight Exercise moves its reps only. The week's RIR target is the lowest number of its range, or 2 when the week has none. The session keeps the target, with the RIR it aimed at, and says why: "Última: 60 kg × 8 · RIR 2. Faz 9 com 60 kg."

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

**Relógio**:
The app's second tab, beside Treino: a date stepper, the Relógio card of the picked date's Health Samples beside its week's and its month's averages, and Ligar Apple Watch, where Health Imports and Watch Workouts come in. Nothing on it is typed.
_Avoid_: Dashboard, Corpo

**Health Sample** (valor do relógio):
One daily metric recorded by the user's Apple Watch on one date, imported into the app rather than typed. The metrics are a fixed list, each with a unit: `standHours` (h), `standMinutes` (min), `steps`, `activeEnergy` (kcal), `exerciseMinutes` (min), `sleepMinutes` (min) and `restingHeartRate` (bpm). A date holds at most one value per metric, and a later import of the same date and metric replaces it, so importing the same data twice changes nothing. The app stores and shows the values and derives nothing from them. They are read only on the Relógio tab, in its Relógio card: the picked date's values, and each metric averaged over the days of its week (Monday to Sunday) and its month that have a value, up to today.

**Health Import** (Ligar Apple Watch):
Bringing the text an iOS Shortcut builds into the app: JSON `{ "samples": [ { "date": "YYYY-MM-DD", "metric": "<metric>", "value": <number ≥ 0> } ] }`, the bare list, or one sample on its own. The panel's `Instalar atalho` hands the iPhone a ready-made Shortcut, signed by the server on a Mac, that posts today and each of the 14 days before as one sample per day and metric, and leaves out a day with no samples. It cannot read sleep or stand hours, whose Health values Shortcuts gives only as words in the phone's language. The Shortcut runs whenever the user runs it, by hand or from a Personal Automation, and posts the text to the server's `/api/health`, which merges it into the Health Samples on the server. An open app takes the new values when its tab comes back into view. When the phone cannot reach the server, the user pastes what the Shortcut copied instead ("Colar manualmente"), and a preview of the count and the dates comes before confirming. Either way, a row with an unknown metric, a bad date or value, or a date and metric already given earlier in the same text rejects the whole text, naming that row, and nothing changes. The panel shows the address to post to and the latest date with a value.
_Avoid_: Reading, measurement

**Watch Workout** (Treino do relógio):
One workout the user's Apple Watch, or another Health source, recorded, read from the Health app's export rather than typed: its activity (the HealthKit activity name, shown in Portuguese, such as Força tradicional), the date and time it started as the export writes them, its minutes, and its active kcal and km when the watch has them. Shortcuts cannot read workouts, so on the iPhone the user exports all Health data (Saúde → profile picture → Exportar todos os dados de saúde) and picks the `export.zip`, or the `export.xml` inside it, in Ligar Apple Watch, on the iPhone or the Mac. The file is read in the browser and never leaves the device; only the workouts are kept. A Workout element the app cannot read is skipped and counted, and the rest import. Its id is the start instant in UTC and the activity, so importing the same export again, or a later export that holds it too, changes nothing, and a newer read of the same id replaces it. Watch Workouts are read only. Treino lists the date's ones beside its Workout Sessions. They are not Workout Sessions, so they count for no training week.
_Avoid_: Session (that is a Workout Session), activity (that is its type)

**Store**:
One document the app keeps under its own key, such as the Workout Sessions or the Health Samples, in the same versioned JSON in localStorage, in a Backup and on the server. The server's database is the copy that counts: it keeps each Store as opaque text with a revision number and never reads its contents, except the Health Samples: a Health Import posted to the server is merged there, into the stored document, as a write like any other. If that document cannot be read, the server leaves it as it is and refuses the import. A browser's localStorage is its working copy, refreshed from the server each time the app opens, and the Health Samples also each time the tab comes back into view, unless this browser has a change to them not yet sent. A change made in one browser that reaches the server after another device changed the same Store is a conflict, and the app then offers to reload the server's copy.
_Avoid_: Table, collection

**Backup**:
One JSON file holding every store the app keeps, and still the one portable copy of the data: Exercises, Workout Plans, Workout Sessions, Health Samples, Watch Workouts and Material (the Locais, the user's own Material and their corrections), each in the form the app saves it. Importing either merges it in or replaces everything. A Backup the meal app exported, the app this one was split from, imports too: its Exercises, Workout Plans, Workout Sessions, Material, Health Samples and Watch Workouts come in, and its Meal Plans, Foods, Household Units, Day Logs, Sleep Entries, Feelings and Mood Notes are ignored. A Workout Plan in a file from before Training Splits that fits no split is dropped from the import, not a reason to reject the file. A merge adds the Exercises, Workout Plans, Workout Sessions and Watch Workouts the user does not already have, by id (a session brings its end feel and After-effects with it), and Health Samples for a date and metric the user has no value for. Locais and the user's own Material are added by id, and a Material correction only for an Exercise the user has not corrected; the active Local stays, or becomes the file's when the user has none. An incoming Exercise named like one the user has, ignoring case, becomes that one, in its sets and its After-effects alike. A file that is invalid in any store the app keeps is rejected whole and changes nothing.
_Avoid_: Sync, export (as a noun)
