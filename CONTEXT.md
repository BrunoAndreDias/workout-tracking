# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table. It is also that person's health log: workouts and how they felt after them, sleep, mood and the daily metrics of their Apple Watch.

## Language

**Meal Plan**:
A named, reusable day of eating (for example "Dia de treino"), composed of ordered Meals and their Food Entries. Its totals are the daily calories and nutrients. It also carries free-text plan notes, such as "Água 3L–3,5L". The user may keep several Meal Plans.

**Day Log** (Registo diário):
What was actually eaten on one calendar date, logged in the app on Alimentação → Hoje, which opens today's day, or any date through `#alimentacao/hoje/<date>`. The Diário calendar colours each date by its Day Log. A Day Log starts from a Meal Plan or blank, and then it keeps its own copy. It can also start as a copy of the last logged day before it, keeping that day's plan, goals and baseline. Started from a plan, it takes the plan's meals (names, times, notes and the optional flag) with no food in them, and a copy of the plan's Daily Goals; the user then imports into each meal what they ate, from any meal or option of any plan. Editing the plan later never changes a logged day. A started day can switch to another plan, or to blank, which starts it over and drops its checks and edits. Its meals are what was planned for the day, and only its Eaten Entries count toward its totals and history. The log also keeps a baseline, which is the plan's meals as they were at the start and is never edited. Comparing each meal against its baseline shows which meals were changed and by how many calories. Switching a meal to another option counts as a change. Editing its time or notes does not, and a meal with no food yet is not marked changed. Importing a meal's own planned option leaves it equal to its baseline. A blank day starts with the default meals and goals and has an empty baseline. A date counts as logged when a Meal that is not optional has at least one Eaten Entry in its active Meal Option. It counts as missed when it is a past date with no entries, on or after the first logged date.
_Avoid_: Daily Journal, diary, diary entry, check-in (in code and domain naming; "Diário" is only UI copy, the name of the home screen)

**Overview** (Resumo):
The numbers the Diário shows for the selected date, its week (Monday to Sunday) and its month, side by side, in four groups. Alimentação has the eaten energy and macronutrients averaged over the logged days against their goals, and how many logged days met the energy goal. Treino has the Workout Sessions, their filled sets, their average end feel and how many After-effects were written on the period's dates. Como te sentes has the average Sleep Entry, the average Feeling and how many dates have a Mood Note. Relógio has each Health Sample metric, the watch's sleep included, averaged over the days that have it. An average rating reads as the word of its nearest whole rating. A week or month counts only its days up to today, and missed days only from the first logged date, as a Day Log does. A Workout Session counts only when it has at least one Logged Set filled in. Watch Workouts show as lines under the date and are not counted. Nothing is edited in the Overview: each group's title opens the tab that logs it, on the selected date, except Como te sentes, which is logged on the Diário itself.
_Avoid_: Dashboard, summary (that is the Nutrition Summary), report

**Eaten Entry** (comido):
A Food Entry of a Day Log checked as eaten. Food copied into a day by repeating a day starts unchecked: it is the plan to follow, and the user checks what they ate, one food at a time or a whole meal from the meal's "Do plano" tray ("Usar o plano"). A Day Log meal lists only its Eaten Entries as rows, and unchecking one sends it back to the tray. A food the user adds, imports from a plan, swaps or re-weighs on the day is checked, since that edit records what was eaten. Food left unchecked was not eaten and counts for nothing, so a day with nothing checked is not logged. Comparing a day with its plan compares what was eaten, so an unchecked planned food counts as left out. Day Logs from before checks existed count every entry as eaten.
_Avoid_: Done, completed, ticked

**Meal**:
A named, reorderable section of a Meal Plan or a Day Log that holds one or more Meal Options. A new Meal Plan begins with Breakfast, Lunch, Dinner, and Snack, and its Meals may be added, renamed, reordered, or removed. A Meal may have a time (HH:MM) and notes. The time is shown and never reorders the meals.
_Avoid_: Meal slot, meal category

**Meal Option** (Opção):
One of a Meal's interchangeable menus, as a nutritionist writes "Opção 1: Papas de aveia / Opção 2: Crepioca". It holds its own Food Entries. Exactly one option is active, and only the active option counts toward the Meal's and the day's totals. A Meal always has at least one option, and a single-option Meal shows no option tabs.

**Optional Meal** (SOS):
A Meal flagged as eaten only if needed, such as "Ceia em SOS". It shows its own totals and is left out of the day's totals and of each meal's share of the day. A day whose only food is in Optional Meals is not logged, so history shows it as missed.

**Food Entry**:
A Food and quantity recorded within a Meal Option. Quantity is stored in grams, although it may be entered and shown in a Household Unit of its Food.
_Avoid_: Item, food item

**Household Unit**:
A named everyday measure of one Food and its weight in grams, for example "ovo M" at 50 g. A Food Entry or Recipe quantity is always stored and first shown in grams, and the user may switch its field to a unit to read or type "2 × ovo M". A field never opens in a unit, even one that fits its grams. The app ships approximate units the APN manual and PortFIR do not give, and the user may add their own for any Food. Deleting a user Food deletes its units.
_Avoid_: Serving, Portion (the APN term)

**Food**:
A nutritional reference that defines nutrient amounts per canonical quantity. It may come from the bundled catalog or be created by the user.
_Avoid_: Ingredient, product

**Recipe**:
A Food the user composes from other Foods and their grams, with an optional final weight after cooking. Its nutrients per 100 g are the summed amounts of its Foods divided by the final weight, or by the summed grams when there is none, and a nutrient unknown for any of its Foods stays unknown. A Recipe uses catalog Foods or Foods entered from a label, never another Recipe.
_Avoid_: Composite food, dish

**Favorite Food**:
A Food explicitly marked by the user for quick access in Food Search.
_Avoid_: Starred item

**Saved Meal**:
A named, reusable set of Foods and quantities that can be appended to a Meal in a Meal Plan.
_Avoid_: Preset, pre-added meal, meal template

**Nutrition Summary**:
A visual account of the calories, macronutrients, and micronutrients contained in a Meal and a Meal Plan, compared against the Meal Plan's Daily Goals. Missing nutrient values remain unavailable rather than being treated as zero, and the Summary discloses incomplete totals.
_Avoid_: Nutrition target, goal summary

**Daily Goals**:
The day's aims stored with each Meal Plan and copied into a Day Log when it starts: energy, protein, carbohydrate and fat are targets to reach, fiber is a minimum, and salt is a limit. A target is met within 5 % of the goal either way, below that it is under, above that it is over. A minimum is never over, and a limit has no tolerance. The goals panel can fill the goals from the day's current totals, because a plan entered from paper states foods and not goals. A new Meal Plan starts at 2 000 kcal, 130 g protein, 220 g carbohydrate, 65 g fat, 30 g fiber and 5 g salt, and a duplicate keeps the original's goals.
_Avoid_: Targets, macros plan, budget

**Exercise** (Exercício):
A named movement the user trains, such as "Supino". It is created by typing a new name in a Workout Day or a Workout Session, and typing a name it already has, ignoring case, picks the existing one. The app ships no exercise library.
_Avoid_: Movement, lift

**Dictation** (Ditado):
Speaking a note instead of typing it. The mic button on a note field records until tapped again, and the transcribed text is appended to the note. The user's voice is transcribed on the device by the Whisper small speech model, which is downloaded once (about 250 MB) the first time the user dictates. No audio leaves the device. Every note can be dictated: plan notes, meal notes, the Mood Note, Exercise Notes, After-effects and the Workout Session's note.
_Avoid_: Voice note (that would be a stored recording; none is kept), voice input

**Workout Plan** (Plano de treino):
A named training program made of Workout Days, written by the user from their own plan. The user may keep several and one is active: its days are the ones a Workout Session can start from. The app never generates, rates or adjusts a plan.
_Avoid_: Program, routine, split; "Plano" alone, which is a Meal Plan

**Workout Day** (Dia de treino):
One named day of a Workout Plan, such as "Peito e tríceps", holding its Planned Exercises in order. An Exercise appears at most once in a day.
_Avoid_: Workout template

**Planned Exercise**:
An Exercise in a Workout Day with its number of sets and a rep range, such as 3 × 8–12. A single target is a range whose minimum and maximum are equal.

**Workout Session** (Treino):
What was trained on one calendar date, in the same date form as the Day Log. It starts from a Workout Day or blank, and then keeps its own copy, so editing the plan later never changes it. Starting from a day gives one row per Planned Exercise with the planned number of sets. Each set is filled in from the latest earlier session that logged that Exercise, repeating its last set when the plan asks for more sets, and is left empty when the Exercise was never logged. An Exercise appears at most once in a session. A session also has free-text notes: one Timed Note about the workout as a whole, and an Exercise Note for each of its Exercises. At its end the user may rate how it felt ("No fim do treino") on the same five words as a Sleep Entry, and on the following days write its After-effects. A date may hold more than one session, and the Diário and Alimentação → Hoje show a line for each. The Diário calendar marks each date with a session that has a filled set.
_Avoid_: Workout (as a type name), training log

**Logged Set**:
One set of a Workout Session: the reps done and the load in kg, or no load for a bodyweight set. A set whose reps are empty is not filled in yet and counts as not logged.
_Avoid_: Rep set, entry

**Sleep Entry** (Sono):
How one night's sleep went: a quality from 1 (muito mal) to 5 (muito bem) as the user rates it on waking, shown as Muito mal, Mal, Normal, Bem or Muito bem. The same five-word scale rates a Feeling and a Workout Session's end feel. The hours slept are not typed: the night's duration is the Apple Watch's `sleepMinutes` Health Sample for the same date, shown read only beside the rating. Entries stored before this change may carry an `hours` field, which is ignored. It belongs to the date the user woke up, and a date has at most one. It is logged on the Diário, in the selected date's Como te sentes card, as the night before that date, with one tap on the quality; tapping the chosen quality again removes it.

**Feeling** (Humor):
How the user feels on one date (`feel` in code), on the same five words as a Sleep Entry, from Muito mal to Muito bem. A date has at most one. It is logged beside the Sleep Entry in the Diário's Como te sentes card with one tap; tapping the chosen word again removes it. A future date cannot be rated. The Diário calendar marks a date's Feeling with a small mouth that frowns at Muito mal, is flat at Normal and smiles at Muito bem. The words in the Feeling say how the day went; the Mood Note says why.
_Avoid_: Mood (alone; that is the Mood Note), mood score, wellbeing

**Exercise Note** (Nota):
A Timed Note on one Exercise of one Workout Session, for pain, discomfort or anything else about how that Exercise went. Starting a session never copies one.

**Mood Note** (Nota de humor):
A Timed Note about how the user felt on one date, written under the Feeling in the Diário's Como te sentes card; a date has at most one. Pain is written here in words, or in a Workout Session's After-effects when training caused it: the app keeps no structured pain log. Pains logged before the Mood Note existed (a body region, an intensity from 0 to 10, an optional time and note) became lines of their date's note, such as "Dor: Lombar 5/10 · 14:00 · nota", timed ones first by time, after any text the note had, and the note counts as written at the earliest pain's time (midday for one without a time).

**After-effect** (Depois do treino):
A Timed Note about how a Workout Session feels on a later date: soreness, pain or recovery that shows a day or two after training. It is about the session as a whole or about one of its Exercises, and a session has at most one per date and Exercise. It is written on Treino → Registo, in the "Treinos anteriores" card of the date it is felt, which lists each session from one to three days before that date. The session's own card lists its After-effects read only by day ("Dia seguinte", "2 dias depois"), so an injury can be followed across days. Removing an Exercise from the session removes its After-effects.
_Avoid_: Injury log, pain entry, follow-up

**Timed Note**:
A free-text note that records when it was written, so a later look at it knows as much as possible: when it first held text and when its text last changed, as local date and time to the second. A note cleared to blank is removed, times and all. The app shows the times under the note, as "Escrito a 6 out, 18:50 · editado 19:02", leaving out the edit within the same minute and repeating the date when the edit was on another day. Mood Notes, Exercise Notes, After-effects and a Workout Session's note are Timed Notes; plan and meal notes are not. A session note from before Timed Notes counts as written at midday of the session's date.

**Health Sample** (valor do relógio):
One daily metric recorded by the user's Apple Watch on one date, imported into the app rather than typed. The metrics are a fixed list, each with a unit: `standHours` (h), `standMinutes` (min), `steps`, `activeEnergy` (kcal), `exerciseMinutes` (min), `sleepMinutes` (min) and `restingHeartRate` (bpm). A date holds at most one value per metric, and a later import of the same date and metric replaces it, so importing the same data twice changes nothing. The app stores and shows the values and derives nothing from them. They are read only in the Diário's Relógio card, and the night's `sleepMinutes` also beside the Sleep Entry on the Diário.

**Health Import** (Ligar Apple Watch):
Bringing the text an iOS Shortcut builds into the app: JSON `{ "samples": [ { "date": "YYYY-MM-DD", "metric": "<metric>", "value": <number ≥ 0> } ] }`, the bare list, or one sample on its own. The panel's `Instalar atalho` hands the iPhone a ready-made Shortcut, signed by the server on a Mac, that posts today and each of the 14 days before as one sample per day and metric, and leaves out a day with no samples. It cannot read sleep or stand hours, whose Health values Shortcuts gives only as words in the phone's language. The Shortcut runs whenever the user runs it, by hand or from a Personal Automation, and posts the text to the server's `/api/health`, which merges it into the Health Samples on the server. An open app takes the new values when its tab comes back into view. When the phone cannot reach the server, the user pastes what the Shortcut copied instead ("Colar manualmente"), and a preview of the count and the dates comes before confirming. Either way, a row with an unknown metric, a bad date or value, or a date and metric already given earlier in the same text rejects the whole text, naming that row, and nothing changes. The panel shows the address to post to and the latest date with a value.
_Avoid_: Reading, measurement

**Watch Workout** (Treino do relógio):
One workout the user's Apple Watch, or another Health source, recorded, read from the Health app's export rather than typed: its activity (the HealthKit activity name, shown in Portuguese, such as Força tradicional), the date and time it started as the export writes them, its minutes, and its active kcal and km when the watch has them. Shortcuts cannot read workouts, so on the iPhone the user exports all Health data (Saúde → profile picture → Exportar todos os dados de saúde) and picks the `export.zip`, or the `export.xml` inside it, in Ligar Apple Watch, on the iPhone or the Mac. The file is read in the browser and never leaves the device; only the workouts are kept. A Workout element the app cannot read is skipped and counted, and the rest import. Its id is the start instant in UTC and the activity, so importing the same export again, or a later export that holds it too, changes nothing, and a newer read of the same id replaces it. Watch Workouts are read only. Treino lists the date's ones beside its Workout Sessions, and the Diário and Alimentação → Hoje show a line for each after the sessions' lines.
_Avoid_: Session (that is a Workout Session), activity (that is its type)

**Store**:
One document the app keeps under its own key, such as the plans or the Sleep Entries, in the same versioned JSON in localStorage, in a Backup and on the server. The server's database is the copy that counts: it keeps each Store as opaque text with a revision number and never reads its contents, except the Health Samples: a Health Import posted to the server is merged there, into the stored document, as a write like any other. If that document cannot be read, the server leaves it as it is and refuses the import. A browser's localStorage is its working copy, refreshed from the server each time the app opens, and the Health Samples also each time the tab comes back into view, unless this browser has a change to them not yet sent. A change made in one browser that reaches the server after another device changed the same Store is a conflict, and the app then offers to reload the server's copy.
_Avoid_: Table, collection

**Backup**:
One JSON file holding every store the app keeps, and still the one portable copy of the data: plans, custom Foods, user Household Units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries, Feelings, Mood Notes, Health Samples and Watch Workouts, each in the form the app saves it. Importing either merges it in or replaces everything. A merge appends its plans, gives a plan a new id when the id is taken (and the suffix " (importado)" when its name is taken too), and adds custom Foods, units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries, Feelings and Watch Workouts the user does not already have, by id or date (a session brings its end feel and After-effects with it), and Health Samples for a date and metric the user has no value for. A Mood Note gains the incoming note's lines it lacks, so merging the same file twice changes nothing. A file from before Mood Notes carries the old pains instead, which import as Mood Note lines. An incoming Exercise named like one the user has, ignoring case, becomes that one, in its sets and its After-effects alike. A file that is invalid anywhere is rejected whole and changes nothing.
_Avoid_: Sync, export (as a noun)

**Equivalent**:
A row of the APN "Manual de Equivalentes Alimentares" (2023): the grams of a Food that make one Portion of an Equivalence Group. Foods in the same group are interchangeable portion for portion.
_Avoid_: Substitute, exchange

**Equivalence Group**:
An APN food group anchored on one nutrient amount per Portion, for example cereals at 28 g of carbohydrate or meat, fish and eggs at 6 g of protein. Groups contain subgroups of closer nutritional similarity.

**Portion**:
The quantity of a Food equal to one Equivalent of its group. A Food Entry's portion count is its grams divided by that Food's Equivalent grams.
_Avoid_: Serving, dose

**Replacement Suggestion**:
A Food from the same Equivalence Group as a Food Entry's Food, with grams converted so the Portion count is preserved. Suggestions from the same subgroup rank first.
_Avoid_: Automatic swap

**Replacement Preview**:
A comparison shown before replacing one Food Entry with another. It starts from the suggested grams (or equal calories for a Food outside the APN table), allows the grams to be edited or set to the replaced entry's own grams (for plans that prescribe grams), and shows the live effect on the Meal and Meal Plan totals.
_Avoid_: Automatic swap, equivalent food
