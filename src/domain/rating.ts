/** How a Workout Session felt at its end, on five words. 1 is the worst, 5 the best. */
export const RATINGS = [
  { value: 1, label: 'Muito mal' },
  { value: 2, label: 'Mal' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Bem' },
  { value: 5, label: 'Muito bem' },
] as const

export type Rating = (typeof RATINGS)[number]['value']

/** The word for a rating; an average takes the word of its nearest whole rating. */
export const ratingWord = (rating: number) => RATINGS[Math.round(rating) - 1].label

export const isRating = (v: unknown): v is Rating => RATINGS.some((r) => r.value === v)
