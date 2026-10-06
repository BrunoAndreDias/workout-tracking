# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table. It is also that person's health log: workouts, sleep and pain now, and later watch metrics.

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

**Workout Plan** (Plano de treino):
A named training program made of Workout Days, written by the user from their own plan. The user may keep several and one is active: its days are the ones a Workout Session can start from. The app never generates, rates or adjusts a plan.
_Avoid_: Program, routine, split; "Plano" alone, which is a Meal Plan

**Workout Day** (Dia de treino):
One named day of a Workout Plan, such as "Peito e tríceps", holding its Planned Exercises in order. An Exercise appears at most once in a day.
_Avoid_: Workout template

**Planned Exercise**:
An Exercise in a Workout Day with its number of sets and a rep range, such as 3 × 8–12. A single target is a range whose minimum and maximum are equal.

**Workout Session** (Treino):
What was trained on one calendar date, in the same date form as the Day Log. It starts from a Workout Day or blank, and then keeps its own copy, so editing the plan later never changes it. Starting from a day gives one row per Planned Exercise with the planned number of sets. Each set is filled in from the latest earlier session that logged that Exercise, repeating its last set when the plan asks for more sets, and is left empty when the Exercise was never logged. An Exercise appears at most once in a session. A session also has free-text notes. A date may hold more than one session, and the Diário shows a line for each.
_Avoid_: Workout (as a type name), training log

**Logged Set**:
One set of a Workout Session: the reps done and the load in kg, or no load for a bodyweight set. A set whose reps are empty is not filled in yet and counts as not logged.
_Avoid_: Rep set, entry

**Sleep Entry** (Sono):
How one night's sleep went: a quality from 1 (muito mal) to 5 (muito bem) and, optionally, the hours slept, up to 24. It belongs to the date the user woke up, and a date has at most one. It is logged in the Diário's Corpo section with one tap on the quality; tapping the chosen quality again removes it.

**Pain Entry** (Dor):
A pain the user felt on one date: the Body Region, a whole intensity from 0 to 10 and, optionally, the time (HH:MM) and a note. A date may hold several. The Diário lists them timed first, by time.

**Body Region** (Zona):
A fixed list of places a pain can be: cabeça, pescoço, costas superiores, lombar, outro, and left and right of ombro, cotovelo, pulso, anca, joelho, tornozelo and pé, since training load differs between sides.

**Health Sample** (not built yet):
One daily metric recorded by the user's Apple Watch, such as stand hours, imported into the app rather than typed.
_Avoid_: Reading, measurement

**Backup**:
One JSON file holding every store the app keeps: plans, custom Foods, user Household Units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries and Pain Entries, each in the form the app saves it. Importing either merges it in or replaces everything. A merge appends its plans, gives a plan a new id when the id is taken (and the suffix " (importado)" when its name is taken too), and adds custom Foods, units, Day Logs, Exercises, Workout Plans, Workout Sessions, Sleep Entries and Pain Entries the user does not already have, by id or date. An incoming Exercise named like one the user has, ignoring case, becomes that one. A file that is invalid anywhere is rejected whole and changes nothing.
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
