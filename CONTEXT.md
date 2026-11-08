# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table. It is also that person's health log: workouts and how they felt after them, sleep, mood and the daily metrics of their Apple Watch.

## Language

**Meal Plan**:
A named, reusable day of eating (for example "Dia de treino"), composed of ordered Meals and their Food Entries. Its totals are the daily calories and nutrients. It also carries free-text plan notes, such as "Água 3L–3,5L". The user may keep several Meal Plans.

**Day Log** (Registo diário):
What was actually eaten on one calendar date, logged in the app on Alimentação → Hoje, which opens today's day, or any date through `#alimentacao/hoje/<date>`. The Diário calendar colours each date by its Day Log. A Day Log starts from a Meal Plan or blank, and then it keeps its own copy. It can also start as a copy of the last logged day before it, keeping that day's plan, goals and baseline. Started from a plan, it takes the plan's meals (names, times, notes and the optional flag) with no food in them, and a copy of the plan's Daily Goals; the user then imports into each meal what they ate, from any meal or option of any plan. Editing the plan later never changes a logged day. A started day can switch to another plan, or to blank, which starts it over and drops its checks and edits. Its meals are what was planned for the day, and only its Eaten Entries count toward its totals and history. The log also keeps a baseline, which is the plan's meals as they were at the start and is never edited. Comparing each meal against its baseline shows which meals were changed and by how many calories. Switching a meal to another option counts as a change. Editing its time or notes does not, and a meal with no food yet is not marked changed. Importing a meal's own planned option leaves it equal to its baseline. A blank day starts with the default meals and goals and has an empty baseline. A date counts as logged when a Meal that is not optional has at least one Eaten Entry in its active Meal Option. It counts as missed when it is a past date with no entries, on or after the first logged date.
_Avoid_: Daily Journal, diary, diary entry, check-in (in code and domain naming; "Diário" is only UI copy, the name of the home screen)

**Overview** (Resumo):
The numbers the Diário shows for the selected date, its week (Monday to Sunday) and its month, side by side, in four groups. Alimentação has the eaten energy and macronutrients averaged over the logged days against their goals, how many logged days met the energy goal, how many Fatty Fish Meals were eaten, and the alcohol eaten in grams and in Standard Drinks. These two are counts with no goal. Treino has the Workout Sessions, their done sets, their average end feel, how many After-effects were written on the period's dates, and the done sets of each muscle group, counted as the plan counts them, with the sets of the user's own Exercises apart; a group with none shows as a gap. Como te sentes has the average Sleep Entry, the average Feeling and how many dates have a Mood Note. Relógio has each Health Sample metric, the watch's sleep included, averaged over the days that have it. An average rating reads as the word of its nearest whole rating. A week or month counts only its days up to today, and missed days only from the first logged date, as a Day Log does. A Workout Session counts only when it has at least one done set. Watch Workouts show as lines under the date and are not counted. Nothing is edited in the Overview: each group's title opens the tab that logs it, on the selected date, except Como te sentes, which is logged on the Diário itself.
_Avoid_: Dashboard, summary (that is the Nutrition Summary), report

**Fatty Fish Meal** (peixe gordo):
A Meal of a logged day, not an Optional Meal, with at least one Eaten Entry of a fatty ocean fish: salmão, sardinha, cavala, sarda, arenque, carapau (chicharro), anchova, biqueirão, truta or enguia, matched by the start of a word in the food's name. A catalog food also has to be in PortFIR's fish category, so a dish such as "Caldeirada de enguias" does not count; canned fish does. The user's own foods and Recipes count by name alone. Fish at lunch and at dinner on one day are two Fatty Fish Meals. It follows the book's 1 to 2 a week.
_Avoid_: Omega-3 meal, fish day

**Standard Drink** (bebida padrão):
10 g of alcohol, the Portuguese standard drink. The Overview turns the alcohol of the eaten food (PortFIR's `alcohol` nutrient, Optional Meals left out) into Standard Drinks, against the book's 0 to 2 a week. It is shown, never judged against a goal.
_Avoid_: Unit, glass

**Eaten Entry** (comido):
A Food Entry of a Day Log checked as eaten. Food copied into a day by repeating a day starts unchecked: it is the plan to follow, and the user checks what they ate, one food at a time or a whole meal from the meal's "Do plano" tray ("Usar o plano"). A Day Log meal lists only its Eaten Entries as rows, and unchecking one sends it back to the tray. A food the user adds, imports from a plan, swaps or re-weighs on the day is checked, since that edit records what was eaten. Food left unchecked was not eaten and counts for nothing, so a day with nothing checked is not logged. Comparing a day with its plan compares what was eaten, so an unchecked planned food counts as left out. Day Logs from before checks existed count every entry as eaten.
_Avoid_: Done, completed, ticked

**Meal**:
A named, reorderable section of a Meal Plan or a Day Log that holds one or more Meal Options. A new Meal Plan begins with Breakfast, Lunch, Dinner, and Snack, and its Meals may be added, renamed, reordered, or removed. A Meal may have a time (HH:MM) and notes. The time is shown and never reorders the meals.
_Avoid_: Meal slot, meal category

**Meal Option** (Opção):
One of a Meal's interchangeable menus, as a nutritionist writes "Opção 1: Papas de aveia / Opção 2: Crepioca". It holds its own Food Entries. Exactly one option is active, and only the active option counts toward the Meal's and the day's totals. A Meal always has at least one option, and a single-option Meal shows no option tabs.

**Meal Protein Floor** (proteína por refeição):
A minimum of protein, 30 g by default, that each Meal should reach, from the book's 30 to 50 g per meal. It is one of the Daily Goals, edited in the goals panel as "Proteína por refeição", and 0 turns it off. A Meal whose counted food (its active option; in a Day Log only its Eaten Entries) is short of it shows "Proteína 22 / 30 g" in its header, in the plan and on Alimentação → Hoje. An Optional Meal, a Meal with nothing counted, and a Meal with a food that has no protein value show nothing.
_Avoid_: Protein target per meal, meal goal

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
The day's aims stored with each Meal Plan and copied into a Day Log when it starts: energy, protein, carbohydrate and fat are targets to reach, fiber is a minimum, and salt is a limit. A target is met within 5 % of the goal either way, below that it is under, above that it is over. A minimum is never over, and a limit has no tolerance. The goals panel can fill the goals from the day's current totals, because a plan entered from paper states foods and not goals. Daily Goals also hold the Meal Protein Floor, which applies to each Meal rather than the day: filling the goals from the day's totals keeps it, and the Overview does not average it. A new Meal Plan starts at 2 000 kcal, 130 g protein, 220 g carbohydrate, 65 g fat, 35 g fiber, 5 g salt and a 30 g Meal Protein Floor, and a duplicate keeps the original's goals. Plans, Day Logs and Backups saved before the floor existed read it as 30 g.
_Avoid_: Targets, macros plan, budget

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
Speaking a note instead of typing it. The mic button on a note field records until tapped again, and the transcribed text is appended to the note. The user's voice is transcribed on the device by the Whisper small speech model, which is downloaded once (about 250 MB) the first time the user dictates. No audio leaves the device. Every note can be dictated: plan notes, meal notes, the Mood Note, Exercise Notes, After-effects and the Workout Session's note. The add-food panel's mic dictates a list of foods instead, read as Spoken Items.
_Avoid_: Voice note (that would be a stored recording; none is kept), voice input

**Spoken Item** (Ditar alimentos):
One food the user named while dictating a list into a Meal from the add-food panel, such as "dois ovos" in "150 gramas de arroz cozido e dois ovos": the words heard, the amount said, and the words searched. The text comes from Dictation, and the rest is fixed rules, never AI. Items are split at commas, "e" and "mais", but not at the "e" inside a number ("cento e cinquenta"). An amount is digits or Portuguese number words, "meio" or "meia" a half, with an optional unit: grams, kilos, millilitres (counted as grams) or litres. An amount with no unit is a count: that many of the Food's first Household Unit, else of its Portion, else of 100 g. A food named with no amount gets the add panel's default. Each item lists the Foods it may mean, the first chosen: those with every word, a plural read as its singular, or, only when none has every word, a word one letter off (two in a word of eight or more), shown as approximate. The user reviews every item, changes its Food or grams, or removes it, and nothing is added until they confirm; then every item is a Food Entry in grams, and on a Day Log an Eaten Entry.
_Avoid_: Voice command, smart add, AI parsing

**Workout Plan** (Plano de treino):
A named training program of one Training Split, made of Training Blocks. It starts from the split's template, every day filled with catalog Exercises, and the user swaps, adds and removes them. The user may keep several and one is active: the days of its current block are the ones a Workout Session can start from, and the day after the last one trained, by its place in the block, comes first. Plans written before Training Splits were kept as their split when every block had 3 or 4 days, the first Exercise of each day as its main lift and the rest as isolation work; any other plan was dropped, and its stored text kept aside.
_Avoid_: Program, routine; "Plano" alone, which is a Meal Plan

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
How long an Exercise stays in its place before the app asks to review it: a length in training weeks, 1 to 52, or no limit, counted from the date it was added or swapped in. Main lifts (Principal) have no limit by default and every other role 8 weeks, since an accessory keeps giving gains for 8 to 10 weeks and then rotates; changing the role does not change it. The weeks count as a Training Block's do, calendar weeks holding a Workout Session with a done set, so a week without training pauses the run, and the week of a date is "semana N de M". A Planned Exercise from before runs counts from the week it was first done. A copied block carries its runs on. An Exercise on several days of a block is one run, as long as its longest there and due at its shortest limit. Once a run of the active plan's current block is done, Treino → Registo lists it under "Exercícios a rever" with two ways out: "Trocar", for another Exercise (the same movement lists first, so the same muscle at another angle), on every day it is planned, or "Mais 4 semanas", four more weeks from now. The plan's row reads "Rever: N semanas feitas".
_Avoid_: Rotation, expiry

**Role** (Função):
What a Planned Exercise does in its day: Principal (the main lift, 6–8 reps), Secundário (8–10), Isolamento (10–15) or Abs (10–15), each 3 sets by default. Compounds (Principal and Secundário) never aim closer to failure than 1 rep in reserve. An Exercise added by hand starts as Abs for core work, Secundário for a catalog compound and Isolamento otherwise.

**Suggested Target** (alvo sugerido):
The kg and reps a Workout Session started from a day fills into each set of an Exercise, by double progression from the done sets of the latest earlier session that has any, at its last set's load. Each such set could have done its reps plus its reps in reserve (the RIR it aimed at when none was logged); the target reps are that minus the week's RIR target, one more when the target did not change and no set was harder than planned. Past the top of the rep range the load goes up 2,5 kg, below the bottom it goes down, and the reps are re-estimated at the new load; a bodyweight Exercise moves its reps only. The week's RIR target is the lowest number of its range, or 2 when the week has none. The session keeps the target, with the RIR it aimed at, and says why: "Última: 60 kg × 8 · RIR 2. Faz 9 com 60 kg."

**Workout Session** (Treino):
What was trained on one calendar date, in the same date form as the Day Log. It starts from a Workout Day of the active plan's current Training Block or blank, and then keeps its own copy, so editing the plan later never changes it. Starting from a day gives one row per Planned Exercise with the planned number of sets, each pending at its Suggested Target, or empty when the Exercise was never done. One tap marks a set done as it stands. An Exercise appears at most once in a session. A session also has free-text notes: one Timed Note about the workout as a whole, and an Exercise Note for each of its Exercises. The session names the muscle groups its done sets trained, with their sets. At its end the user may rate how it felt ("No fim do treino") on the same five words as a Sleep Entry, and on the following days write its After-effects. A date may hold more than one session, and the Diário and Alimentação → Hoje show a line for each. The Diário calendar marks each date with a session that has a done set.
_Avoid_: Workout (as a type name), training log

**Logged Set**:
One set of a Workout Session: the load in kg, or no load for a bodyweight set, the reps, an optional reps in reserve (RIR, 0 to 5 or more), and whether it is done. Only a done set counts, everywhere: in the Overview, the calendar, the training weeks and the next Suggested Target. A set becomes done only by the user's tap, and only with reps; typing kg or reps never marks it. A set stays pending until then, kept with what was suggested or typed. Picking a RIR also fills the next pending set that has none. Sets logged before done sets existed count as done when they have reps.
_Avoid_: Rep set, entry; "filled" for done

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
One JSON file holding every store the app keeps, and still the one portable copy of the data: plans, custom Foods, user Household Units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries, Feelings, Mood Notes, Health Samples, Watch Workouts and Material (the Locais, the user's own Material and their corrections), each in the form the app saves it. Importing either merges it in or replaces everything. A Workout Plan in a file from before Training Splits that fits no split is dropped from the import, not a reason to reject the file. A merge appends its plans, gives a plan a new id when the id is taken (and the suffix " (importado)" when its name is taken too), and adds custom Foods, units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries, Feelings and Watch Workouts the user does not already have, by id or date (a session brings its end feel and After-effects with it), and Health Samples for a date and metric the user has no value for. Locais and the user's own Material are added by id, and a Material correction only for an Exercise the user has not corrected; the active Local stays, or becomes the file's when the user has none. A Mood Note gains the incoming note's lines it lacks, so merging the same file twice changes nothing. A file from before Mood Notes carries the old pains instead, which import as Mood Note lines. An incoming Exercise named like one the user has, ignoring case, becomes that one, in its sets and its After-effects alike. A file that is invalid anywhere is rejected whole and changes nothing.
_Avoid_: Sync, export (as a noun)

**Equivalent**:
A row of the APN "Manual de Equivalentes Alimentares" (2023): the grams of a Food that make one Portion of an Equivalence Group. Foods in the same group are interchangeable portion for portion.
_Avoid_: Substitute, exchange

**Equivalence Group**:
An APN food group anchored on one nutrient amount per Portion, for example cereals at 28 g of carbohydrate or meat, fish and eggs at 6 g of protein. Groups contain subgroups of closer nutritional similarity.

**Portion**:
The quantity of a Food equal to one Equivalent of its group. A Food Entry's portion count is its grams divided by that Food's Equivalent grams.
_Avoid_: Serving, dose

**Derived Equivalent**:
An approximate Portion of a Food the APN table does not list, worked out at build time from the Food's fat, carbohydrate or protein per 100 g and its PortFIR category, and kept only when it lands near the grams APN gives that group. It only starts a Replacement Suggestion: a Food with a Derived Equivalent is never suggested for another, and a Food with an Equivalent never has one.
_Avoid_: Estimated equivalent

**Replacement Suggestion**:
A Food from the same Equivalence Group as a Food Entry's Food, with grams converted so the Portion count is preserved. Suggestions from the same subgroup rank first. A Food outside the APN table starts from its Derived Equivalent, so its suggestions are approximate and all come from APN foods.
_Avoid_: Automatic swap

**Replacement Preview**:
A comparison shown before replacing one Food Entry with another. It starts from the suggested grams (or equal calories for a Food with neither an Equivalent nor a Derived Equivalent), allows the grams to be edited or set to the replaced entry's own grams (for plans that prescribe grams), and shows the live effect on the Meal and Meal Plan totals.
_Avoid_: Automatic swap, equivalent food
