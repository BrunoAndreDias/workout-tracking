export function newId<T extends string>(): T {
  return crypto.randomUUID() as string as T
}
