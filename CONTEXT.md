# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table.

## Language

**Meal Plan**:
A named, reusable day of eating (for example "Dia de treino"), composed of ordered Meals and their Food Entries. Its totals are the daily calories and nutrients. The user may keep several Meal Plans.

**Day Log** (Registo diário):
What was actually eaten on one calendar date, shown in the app as "Diário". A Day Log starts from a Meal Plan or blank, and then it keeps its own copy. Its meals are a copy of the plan's meals, and its goals are a copy of the plan's Daily Goals. Editing the plan later never changes a logged day. The log also keeps a baseline, which is the plan's meals as they were at the start and is never edited. Comparing each meal against its baseline shows which meals were changed and by how many calories. A blank day starts with the default meals and goals and has an empty baseline. A date counts as logged when it has at least one Food Entry. It counts as missed when it is a past date with no entries, on or after the first logged date.
_Avoid_: Daily Journal, diary, diary entry, check-in (in code and domain naming; "Diário" is only UI copy)

**Meal**:
A named, reorderable section of a Meal Plan or a Day Log that groups Food Entries. A new Meal Plan begins with Breakfast, Lunch, Dinner, and Snack, and its Meals may be added, renamed, reordered, or removed.
_Avoid_: Meal slot, meal category

**Food Entry**:
A Food and quantity recorded within a Meal. Quantity is stored in grams, although it may be entered and shown in a Household Unit of its Food.
_Avoid_: Item, food item

**Household Unit**:
A named everyday measure of one Food and its weight in grams, for example "ovo M" at 50 g. A Food Entry or Recipe quantity reads as "2 × ovo M" when its grams are a whole or half count of the unit, and is always stored as grams. The app ships approximate units the APN manual and PortFIR do not give, and the user may add their own for any Food. Deleting a user Food deletes its units.
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
The day's aims stored with each Meal Plan and copied into a Day Log when it starts: energy, protein, carbohydrate and fat are targets to reach, fiber is a minimum, and salt is a limit. A target is met within 10 % of the goal either way, below that it is under, above that it is over. A minimum is never over, and a limit has no tolerance. The goals panel can fill the goals from the day's current totals, because a plan entered from paper states foods and not goals. A new Meal Plan starts at 2 000 kcal, 130 g protein, 220 g carbohydrate, 65 g fat, 30 g fiber and 5 g salt, and a duplicate keeps the original's goals.
_Avoid_: Targets, macros plan, budget

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
