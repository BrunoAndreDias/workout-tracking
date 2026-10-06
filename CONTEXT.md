# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table. It is also that person's health log: workouts, sleep, mood and the daily metrics of their Apple Watch.

## Language

**Meal Plan**:
A named, reusable day of eating (for example "Dia de treino"), composed of ordered Meals and their Food Entries. Its totals are the daily calories and nutrients. It also carries free-text plan notes, such as "Água 3L–3,5L". The user may keep several Meal Plans.

**Day Log** (Registo diário):
What was actually eaten on one calendar date, shown in the app as "Diário". A Day Log starts from a Meal Plan or blank, and then it keeps its own copy. It can also start as a copy of the last logged day before it, keeping that day's plan, goals and baseline. Its meals are a copy of the plan's meals, and its goals are a copy of the plan's Daily Goals. Editing the plan later never changes a logged day. The log also keeps a baseline, which is the plan's meals as they were at the start and is never edited. Comparing each meal against its baseline shows which meals were changed and by how many calories. Switching a meal to another option counts as a change. Editing its time or notes does not. A blank day starts with the default meals and goals and has an empty baseline. A date counts as logged when a Meal that is not optional has at least one Food Entry in its active Meal Option. It counts as missed when it is a past date with no entries, on or after the first logged date.
_Avoid_: Daily Journal, diary, diary entry, check-in (in code and domain naming; "Diário" is only UI copy)

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
Speaking a note instead of typing it. The mic button on a note field records until tapped again, and the transcribed text is appended to the note. The user's voice is transcribed on the device by the Whisper small speech model, which is downloaded once (about 250 MB) the first time the user dictates. No audio leaves the device. Every note can be dictated: plan notes, meal notes, the Mood Note, Exercise Notes and the Workout Session's note.
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
What was trained on one calendar date, in the same date form as the Day Log. It starts from a Workout Day or blank, and then keeps its own copy, so editing the plan later never changes it. Starting from a day gives one row per Planned Exercise with the planned number of sets. Each set is filled in from the latest earlier session that logged that Exercise, repeating its last set when the plan asks for more sets, and is left empty when the Exercise was never logged. An Exercise appears at most once in a session. A session also has free-text notes: one Timed Note about the workout as a whole, and an Exercise Note for each of its Exercises. A date may hold more than one session, and the Diário shows a line for each.
_Avoid_: Workout (as a type name), training log

**Logged Set**:
One set of a Workout Session: the reps done and the load in kg, or no load for a bodyweight set. A set whose reps are empty is not filled in yet and counts as not logged.
_Avoid_: Rep set, entry

**Sleep Entry** (Sono):
How one night's sleep went: a quality from 1 (muito mal) to 5 (muito bem) as the user rates it on waking, shown as Muito mal, Mal, Normal, Bem or Muito bem. The hours slept are not typed: the night's duration is the Apple Watch's `sleepMinutes` Health Sample for the same date, shown read only beside the rating. Entries stored before this change may carry an `hours` field, which is ignored. It belongs to the date the user woke up, and a date has at most one. It is logged in the Diário's Corpo section with one tap on the quality; tapping the chosen quality again removes it.

**Exercise Note** (Nota):
A Timed Note on one Exercise of one Workout Session, for pain, discomfort or anything else about how that Exercise went. Starting a session never copies one.

**Mood Note** (Humor):
A Timed Note about how the user felt on one date, written in the Diário's Corpo section; a date has at most one. Pain is written here in words: the app keeps no structured pain log. Pains logged before the Mood Note existed (a body region, an intensity from 0 to 10, an optional time and note) became lines of their date's note, such as "Dor: Lombar 5/10 · 14:00 · nota", timed ones first by time, after any text the note had, and the note counts as written at the earliest pain's time (midday for one without a time).

**Timed Note**:
A free-text note that records when it was written, so a later look at it knows as much as possible: when it first held text and when its text last changed, as local date and time to the second. A note cleared to blank is removed, times and all. The app shows the times under the note, as "Escrito a 6 out, 18:50 · editado 19:02", leaving out the edit within the same minute and repeating the date when the edit was on another day. Mood Notes, Exercise Notes and a Workout Session's note are Timed Notes; plan and meal notes are not. A session note from before Timed Notes counts as written at midday of the session's date.

**Health Sample** (valor do relógio):
One daily metric recorded by the user's Apple Watch on one date, imported into the app rather than typed. The metrics are a fixed list, each with a unit: `standHours` (h), `standMinutes` (min), `steps`, `activeEnergy` (kcal), `exerciseMinutes` (min), `sleepMinutes` (min) and `restingHeartRate` (bpm). A date holds at most one value per metric, and a later import of the same date and metric replaces it, so importing the same data twice changes nothing. The app stores and shows the values and derives nothing from them. They are read only in the Diário's Corpo section.

**Health Import** (Importar do Apple Watch):
Pasting the text an iOS Shortcut copied: JSON `{ "samples": [ { "date": "YYYY-MM-DD", "metric": "<metric>", "value": <number ≥ 0> } ] }`, or the bare list. A row with an unknown metric, a bad date or value, or a date and metric already given earlier in the paste rejects the whole paste, naming that row, and nothing changes. A preview of the count and the dates comes before confirming.
_Avoid_: Reading, measurement

**Store**:
One document the app keeps under its own key, such as the plans or the Sleep Entries, in the same versioned JSON in localStorage, in a Backup and on the server. The server's database is the copy that counts: it keeps each Store as opaque text with a revision number and never reads its contents. A browser's localStorage is its working copy, refreshed from the server each time the app opens. A change made in one browser that reaches the server after another device changed the same Store is a conflict, and the app then offers to reload the server's copy.
_Avoid_: Table, collection

**Backup**:
One JSON file holding every store the app keeps, and still the one portable copy of the data: plans, custom Foods, user Household Units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries, Mood Notes and Health Samples, each in the form the app saves it. Importing either merges it in or replaces everything. A merge appends its plans, gives a plan a new id when the id is taken (and the suffix " (importado)" when its name is taken too), and adds custom Foods, units, Day Logs, Exercises, Workout Plans, Workout Sessions and Sleep Entries the user does not already have, by id or date, and Health Samples for a date and metric the user has no value for. A Mood Note gains the incoming note's lines it lacks, so merging the same file twice changes nothing. A file from before Mood Notes carries the old pains instead, which import as Mood Note lines. An incoming Exercise named like one the user has, ignoring case, becomes that one. A file that is invalid anywhere is rejected whole and changes nothing.
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
