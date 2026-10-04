# Nutrition Tracking

This context describes how one person plans their meals and reviews the nutritional effect of swapping foods using the Portuguese APN equivalents table.

## Language

**Meal Plan**:
A named, reusable day of eating (for example "Dia de treino"), composed of ordered Meals and their Food Entries. Its totals are the daily calories and nutrients. The user may keep several Meal Plans.
_Avoid_: Daily Journal, diary, day log

**Meal**:
A named, reorderable section of a Meal Plan that groups Food Entries. A new Meal Plan begins with Breakfast, Lunch, Dinner, and Snack, and its Meals may be added, renamed, reordered, or removed.
_Avoid_: Meal slot, meal category

**Food Entry**:
A Food and quantity recorded within a Meal. Quantity is stored in grams, although a Food may expose named serving choices that resolve to grams.
_Avoid_: Item, food item

**Food**:
A nutritional reference that defines nutrient amounts per canonical quantity. It may come from the bundled catalog or be created by the user.
_Avoid_: Ingredient, product

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
The day's aims stored with each Meal Plan: energy, protein, carbohydrate and fat are targets to reach, fiber is a minimum, and salt is a limit. A new Meal Plan starts at 2 000 kcal, 130 g protein, 220 g carbohydrate, 65 g fat, 30 g fiber and 5 g salt, and a duplicate keeps the original's goals.
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
A comparison shown before replacing one Food Entry with another. It starts from the suggested grams (or equal calories for a Food outside the APN table), allows the grams to be edited, and shows the live effect on the Meal and Meal Plan totals.
_Avoid_: Automatic swap, equivalent food
