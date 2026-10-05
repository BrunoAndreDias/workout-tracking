type Brand<T, B extends string> = T & { readonly __brand: B }

export type FoodId = Brand<string, 'FoodId'>
export type PlanId = Brand<string, 'PlanId'>
export type MealId = Brand<string, 'MealId'>
export type EntryId = Brand<string, 'EntryId'>
/** A local calendar day, 'YYYY-MM-DD'. */
export type IsoDate = Brand<string, 'IsoDate'>

export const NUTRIENTS = [
  { key: 'energyKcal', label: 'Energia', unit: 'kcal' },
  { key: 'energyKj', label: 'Energia', unit: 'kJ' },
  { key: 'fat', label: 'Lípidos', unit: 'g' },
  { key: 'saturatedFat', label: 'Ácidos gordos saturados', unit: 'g' },
  { key: 'monounsaturatedFat', label: 'Ácidos gordos monoinsaturados', unit: 'g' },
  { key: 'polyunsaturatedFat', label: 'Ácidos gordos polinsaturados', unit: 'g' },
  { key: 'linoleicAcid', label: 'Ácido linoleico', unit: 'g' },
  { key: 'transFat', label: 'Ácidos gordos trans', unit: 'g' },
  { key: 'carbohydrate', label: 'Hidratos de carbono', unit: 'g' },
  { key: 'sugars', label: 'Açúcares', unit: 'g' },
  { key: 'oligosaccharides', label: 'Oligossacáridos', unit: 'g' },
  { key: 'starch', label: 'Amido', unit: 'g' },
  { key: 'salt', label: 'Sal', unit: 'g' },
  { key: 'fiber', label: 'Fibra', unit: 'g' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'alcohol', label: 'Álcool', unit: 'g' },
  { key: 'water', label: 'Água', unit: 'g' },
  { key: 'organicAcids', label: 'Ácidos orgânicos', unit: 'g' },
  { key: 'cholesterol', label: 'Colesterol', unit: 'mg' },
  { key: 'vitaminA', label: 'Vitamina A', unit: 'µg' },
  { key: 'betaCaroteneEq', label: 'Equivalentes de β-caroteno', unit: 'µg' },
  { key: 'alphaCarotene', label: 'α-caroteno', unit: 'µg' },
  { key: 'betaCarotene', label: 'β-caroteno', unit: 'µg' },
  { key: 'betaCryptoxanthin', label: 'β-criptoxantina', unit: 'µg' },
  { key: 'lycopene', label: 'Licopeno', unit: 'µg' },
  { key: 'lutein', label: 'Luteína', unit: 'µg' },
  { key: 'zeaxanthin', label: 'Zeaxantina', unit: 'µg' },
  { key: 'vitaminD', label: 'Vitamina D', unit: 'µg' },
  { key: 'alphaTocopherol', label: 'α-tocoferol', unit: 'mg' },
  { key: 'thiamin', label: 'Tiamina', unit: 'mg' },
  { key: 'riboflavin', label: 'Riboflavina', unit: 'mg' },
  { key: 'niacin', label: 'Niacina', unit: 'mg' },
  { key: 'niacinEq', label: 'Equivalentes de niacina', unit: 'mg' },
  { key: 'tryptophan60', label: 'Triptofano/60', unit: 'mg' },
  { key: 'vitaminB6', label: 'Vitamina B6', unit: 'mg' },
  { key: 'vitaminB12', label: 'Vitamina B12', unit: 'µg' },
  { key: 'vitaminC', label: 'Vitamina C', unit: 'mg' },
  { key: 'folate', label: 'Folatos', unit: 'µg' },
  { key: 'ash', label: 'Cinza', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
  { key: 'potassium', label: 'Potássio', unit: 'mg' },
  { key: 'calcium', label: 'Cálcio', unit: 'mg' },
  { key: 'phosphorus', label: 'Fósforo', unit: 'mg' },
  { key: 'magnesium', label: 'Magnésio', unit: 'mg' },
  { key: 'iron', label: 'Ferro', unit: 'mg' },
  { key: 'zinc', label: 'Zinco', unit: 'mg' },
  { key: 'selenium', label: 'Selénio', unit: 'µg' },
  { key: 'iodine', label: 'Iodo', unit: 'µg' },
] as const

export type NutrientKey = (typeof NUTRIENTS)[number]['key']

/** `null` means the source has no value. It is never coerced to zero. */
export type NutrientValues = Readonly<Record<NutrientKey, number | null>>

export interface Food {
  readonly id: FoodId
  readonly name: string
  readonly source: 'portfir' | 'usda' | 'custom'
  /** PortFIR expresses alcoholic beverages per 100 ml; entries still store grams and treat 1 ml as 1 g. */
  readonly basis: 'per100g' | 'per100ml'
  readonly category: string
  readonly per100: NutrientValues
}

export interface RecipeIngredient {
  readonly foodId: FoodId
  readonly grams: number
}

/** `yieldGrams` is the weight after cooking; null means the sum of the ingredient grams. */
export interface Recipe {
  readonly ingredients: readonly RecipeIngredient[]
  readonly yieldGrams: number | null
}

interface CustomFoodDefBase {
  readonly id: FoodId
  readonly name: string
  readonly basedOn: FoodId | null
}

/** What the user stored: a label's values, or a recipe whose values are derived from its ingredients on load. */
export type CustomFoodDef =
  | (CustomFoodDefBase & { readonly kind: 'label'; readonly per100: NutrientValues })
  | (CustomFoodDefBase & { readonly kind: 'recipe'; readonly recipe: Recipe })

/** A user food resolved to nutrients. `basedOn` is the generic catalog food whose APN equivalents it borrows. */
export type CustomFood = Food & { readonly source: 'custom'; readonly basedOn: FoodId | null; readonly recipe: Recipe | null }

export interface EquivalenceGroup {
  readonly id: string
  readonly name: string
  readonly anchor: { readonly nutrient: 'carbohydrate' | 'protein' | 'fat'; readonly grams: number }
}

/** One row of the APN table: `portionGrams` of `foodId` is one portion of `groupId`. A food may appear in several groups. */
export interface Equivalent {
  readonly groupId: string
  readonly subgroup: string
  readonly foodId: FoodId
  readonly portionGrams: number
}

export interface EquivalenceTable {
  readonly groups: readonly EquivalenceGroup[]
  readonly equivalents: readonly Equivalent[]
}

export interface FoodEntry {
  readonly id: EntryId
  readonly foodId: FoodId
  readonly grams: number
}

export interface Meal {
  readonly id: MealId
  readonly name: string
  readonly entries: readonly FoodEntry[]
}

/** What one Meal Plan aims for in a day. Grams, except energy in kcal. */
export interface Goals {
  readonly energyKcal: number
  readonly protein: number
  readonly carbohydrate: number
  readonly fat: number
  readonly fiber: number
  readonly salt: number
}

export interface MealPlan {
  readonly id: PlanId
  readonly name: string
  readonly goals: Goals
  readonly meals: readonly Meal[]
}

/**
 * What was eaten on one date. Started from a Meal Plan as a snapshot, so later plan edits never rewrite it.
 * `baseline` is the plan's meals at start, with the same ids as `meals`, and is never edited; it is empty for a blank day.
 */
export interface DayLog {
  readonly date: IsoDate
  readonly planId: PlanId | null
  readonly goals: Goals
  readonly meals: readonly Meal[]
  readonly baseline: readonly Meal[]
}

/** A sum over entries. `missing` lists nutrients for which at least one contributing food had no value. */
export interface NutrientTotals {
  readonly amounts: Readonly<Record<NutrientKey, number>>
  readonly missing: ReadonlySet<NutrientKey>
}

export interface ReplacementSuggestion {
  readonly food: Food
  readonly grams: number
  readonly portions: number
  readonly group: EquivalenceGroup
  readonly subgroup: string
  readonly sameSubgroup: boolean
}
