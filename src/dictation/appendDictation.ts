/** Adds dictated text after a note, on the same line unless the note already ends a line. */
export function appendDictation(existing: string, text: string): string {
  const added = text.trim()
  if (added === '') return existing
  if (existing.trim() === '') return added
  return /\n[ \t]*$/.test(existing) ? existing + added : existing.trimEnd() + ' ' + added
}
