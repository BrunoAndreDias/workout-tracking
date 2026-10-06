import { describe, expect, it } from 'vitest'
import { importSpan, parseHealthImport, samplesOn, upsertSamples } from './health.ts'
import type { HealthSample } from './health.ts'
import { loadHealth, parseHealth, saveHealth } from './healthStorage.ts'
import type { IsoDate } from './types.ts'

const PASTE = JSON.stringify({
  samples: [
    { date: '2026-10-05', metric: 'steps', value: 8123 },
    { date: '2026-10-05', metric: 'standHours', value: 9 },
    { date: '2026-10-04', metric: 'restingHeartRate', value: 54 },
  ],
})

const samples = (text: string): readonly HealthSample[] => {
  const r = parseHealthImport(text)
  if (!r.ok) throw new Error(r.error)
  return r.samples
}

function memoryStorage() {
  const data: Record<string, string> = {}
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
}

describe('health import', () => {
  it('reads the samples object and the bare list alike', () => {
    const expected = [
      { date: '2026-10-05', metric: 'steps', value: 8123 },
      { date: '2026-10-05', metric: 'standHours', value: 9 },
      { date: '2026-10-04', metric: 'restingHeartRate', value: 54 },
    ]
    expect(samples(PASTE)).toEqual(expected)
    expect(samples(JSON.stringify(JSON.parse(PASTE).samples))).toEqual(expected)
  })

  it.each([
    ['text that is not JSON', 'steps: 8123', 'O texto não é JSON válido. Não foi alterado nada.'],
    ['an object without samples', '{"data": []}', 'Esperava { "samples": [ … ] } ou uma lista de valores. Não foi alterado nada.'],
    ['an empty list', '[]', 'Não há valores para importar.'],
    [
      'an unknown metric in row 2',
      '[{"date":"2026-10-05","metric":"steps","value":1},{"date":"2026-10-05","metric":"sittingHours","value":3}]',
      'Valor n.º 2: a métrica "sittingHours" não existe. Não foi alterado nada.',
    ],
    ['a bad date', '[{"date":"05/10/2026","metric":"steps","value":1}]', 'Valor n.º 1: a data "05/10/2026" não é AAAA-MM-DD. Não foi alterado nada.'],
    ['a negative value', '[{"date":"2026-10-05","metric":"steps","value":-4}]', 'Valor n.º 1: o valor -4 não é um número maior ou igual a zero. Não foi alterado nada.'],
    ['a value as text', '[{"date":"2026-10-05","metric":"steps","value":"8123"}]', 'Valor n.º 1: o valor "8123" não é um número maior ou igual a zero. Não foi alterado nada.'],
    [
      'a date and metric twice',
      '[{"date":"2026-10-05","metric":"steps","value":1},{"date":"2026-10-05","metric":"steps","value":2}]',
      'Valor n.º 2: steps de 2026-10-05 já veio antes. Não foi alterado nada.',
    ],
  ])('rejects %s, naming the first bad row', (_, text, error) => {
    expect(parseHealthImport(text)).toEqual({ ok: false, error })
  })

  it('upserting the same paste twice gives the state of once', () => {
    const once = upsertSamples({}, samples(PASTE))
    expect(upsertSamples(once, samples(PASTE))).toEqual(once)
    expect(once).toEqual({ '2026-10-05': { steps: 8123, standHours: 9 }, '2026-10-04': { restingHeartRate: 54 } })
  })

  it('a newer import overwrites the same date and metric and keeps the rest', () => {
    const log = upsertSamples(upsertSamples({}, samples(PASTE)), [{ date: '2026-10-05' as IsoDate, metric: 'steps', value: 9000 }])
    expect(log['2026-10-05' as IsoDate]).toEqual({ steps: 9000, standHours: 9 })
  })

  it('lists a date’s samples in the metrics’ order', () => {
    const log = upsertSamples({}, samples(PASTE))
    expect(samplesOn(log, '2026-10-05' as IsoDate).map((s) => [s.metric, s.value])).toEqual([
      ['standHours', 9],
      ['steps', 8123],
    ])
  })

  it('spans the dates of a paste', () => {
    const r = parseHealthImport(PASTE)
    expect(r.ok && importSpan(r.samples)).toEqual({ count: 3, from: '2026-10-04', to: '2026-10-05' })
  })
})

describe('health storage', () => {
  it('stores the import rows by date and metric order and reads them back', () => {
    const storage = memoryStorage()
    saveHealth(upsertSamples({}, samples(PASTE)), storage)
    expect(storage.data['nutrition-tracking:health']).toBe(
      '{"version":1,"samples":[{"date":"2026-10-04","metric":"restingHeartRate","value":54},{"date":"2026-10-05","metric":"standHours","value":9},{"date":"2026-10-05","metric":"steps","value":8123}]}',
    )
    expect(loadHealth(storage)).toEqual({ '2026-10-04': { restingHeartRate: 54 }, '2026-10-05': { standHours: 9, steps: 8123 } })
  })

  it.each([
    ['an unknown version', { version: 2, samples: [] }],
    ['an unknown metric', { version: 1, samples: [{ date: '2026-10-05', metric: 'sitting', value: 1 }] }],
    ['a date and metric twice', { version: 1, samples: [{ date: '2026-10-05', metric: 'steps', value: 1 }, { date: '2026-10-05', metric: 'steps', value: 1 }] }],
  ])('rejects %s', (_, raw) => {
    expect(parseHealth(raw)).toBe(null)
  })
})
