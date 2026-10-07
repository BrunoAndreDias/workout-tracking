/**
 * The localStorage key of every store the app keeps, by Backup store name. The server keeps exactly these documents;
 * device-local keys (the theme, `:unreadable:` and `:unsynced:` copies, the sync bookkeeping) are not stores.
 * It imports nothing, so the Node server can import it without the browser's domain graph.
 */
export const STORE_KEY = {
  plans: 'nutrition-tracking:plans',
  foods: 'nutrition-tracking:foods',
  units: 'nutrition-tracking:units',
  days: 'nutrition-tracking:days',
  exercises: 'nutrition-tracking:exercises',
  workoutPlans: 'nutrition-tracking:workout-plans',
  workoutSessions: 'nutrition-tracking:workout-sessions',
  sleep: 'nutrition-tracking:sleep',
  feel: 'nutrition-tracking:feel',
  // Mood Notes took over the key of the Pain Entries they replaced, so the server's copy migrates where it is.
  moods: 'nutrition-tracking:pains',
  health: 'nutrition-tracking:health',
  watchWorkouts: 'nutrition-tracking:watch-workouts',
} as const

export type StoreKey = (typeof STORE_KEY)[keyof typeof STORE_KEY]

export const STORE_KEYS: readonly StoreKey[] = Object.values(STORE_KEY)

export const isStoreKey = (key: string): key is StoreKey => (STORE_KEYS as readonly string[]).includes(key)
