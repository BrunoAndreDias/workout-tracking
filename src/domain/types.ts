type Brand<T, B extends string> = T & { readonly __brand: B }

/** A local calendar day, 'YYYY-MM-DD'. */
export type IsoDate = Brand<string, 'IsoDate'>
/** A local date and time to the second, 'YYYY-MM-DDTHH:MM:SS', with no zone: when the user wrote something, as their clock read. */
export type LocalDateTime = Brand<string, 'LocalDateTime'>
export type ExerciseId = Brand<string, 'ExerciseId'>
export type WorkoutPlanId = Brand<string, 'WorkoutPlanId'>
export type WorkoutDayId = Brand<string, 'WorkoutDayId'>
export type WorkoutBlockId = Brand<string, 'WorkoutBlockId'>
export type WorkoutSessionId = Brand<string, 'WorkoutSessionId'>
/** Material the user named themselves, 'mat:<uuid>', so it never collides with a built-in id. */
export type CustomEquipmentId = Brand<`mat:${string}`, 'CustomEquipmentId'>
export type GymId = Brand<string, 'GymId'>
