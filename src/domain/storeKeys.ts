/**
 * The localStorage key of every store the app keeps, by Backup store name. The server keeps exactly these documents;
 * device-local keys (the theme, `:unreadable:` and `:unsynced:` copies, the sync bookkeeping) are not stores.
 * It imports nothing, so the Node server can import it without the browser's domain graph.
 */
export const STORE_KEY = {
  exercises: 'workout-tracking:exercises',
  workoutPlans: 'workout-tracking:workout-plans',
  workoutSessions: 'workout-tracking:workout-sessions',
  equipment: 'workout-tracking:equipment',
} as const

export type StoreKey = (typeof STORE_KEY)[keyof typeof STORE_KEY]

export const STORE_KEYS: readonly StoreKey[] = Object.values(STORE_KEY)

export const isStoreKey = (key: string): key is StoreKey => (STORE_KEYS as readonly string[]).includes(key)
