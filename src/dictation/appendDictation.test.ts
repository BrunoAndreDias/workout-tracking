import { expect, test } from 'vitest'
import { appendDictation } from './appendDictation'

test('an empty note becomes the text', () => {
  expect(appendDictation('', 'dois ovos')).toBe('dois ovos')
})

test('text follows the existing note after one space', () => {
  expect(appendDictation('Água 3 L.  ', 'dois ovos')).toBe('Água 3 L. dois ovos')
})

test('a note ending in a newline keeps it', () => {
  expect(appendDictation('Água 3 L.\n', 'dois ovos')).toBe('Água 3 L.\ndois ovos')
})

test('empty or blank transcription leaves the note unchanged', () => {
  expect(appendDictation('Água 3 L. ', '')).toBe('Água 3 L. ')
  expect(appendDictation('Água 3 L. ', '  \n')).toBe('Água 3 L. ')
})
