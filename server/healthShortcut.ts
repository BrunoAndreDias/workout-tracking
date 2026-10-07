import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { HealthMetric } from '../src/domain/health.ts'

/**
 * Category samples, which Shortcuts reads as text in the phone's language ("A dormir", "Tempo de pé"), so no filter
 * keeps only the asleep or stood ones on every phone. They still come in through the paste.
 */
type NotInShortcut = 'standHours' | 'sleepMinutes'

/**
 * Each metric's Health type as Find Health Samples names it, which is ActionKit's readable-type table, not the Health
 * app's label (see docs/research/ios-shortcut-plist.md). All are quantity types, so grouping by day makes HealthKit sum
 * the cumulative ones and average resting heart rate, merging iPhone and Watch the way the Health app does.
 */
const SHORTCUT_HEALTH_TYPES = {
  standMinutes: 'Stand Time',
  steps: 'Steps',
  activeEnergy: 'Active Calories',
  exerciseMinutes: 'Exercise Time',
  restingHeartRate: 'Resting Heart Rate',
} as const satisfies Record<Exclude<HealthMetric, NotInShortcut>, string>

type ShortcutMetric = keyof typeof SHORTCUT_HEALTH_TYPES

type Plist = string | number | boolean | readonly Plist[] | { readonly [key: string]: Plist }

const OBJECT_REPLACEMENT = '￼'

const output = (uuid: string, name: string) => ({ OutputUUID: uuid, OutputName: name, Type: 'ActionOutput' })
type Output = ReturnType<typeof output>

const attachment = (ref: Output) => ({ Value: ref, WFSerializationType: 'WFTextTokenAttachment' })
const tokenText = (ref: Output) => ({ Value: { string: OBJECT_REPLACEMENT, attachmentsByRange: { '{0, 1}': ref } }, WFSerializationType: 'WFTextTokenString' })
const plainText = (text: string) => ({ Value: { string: text, attachmentsByRange: {} }, WFSerializationType: 'WFTextTokenString' })
const action = (id: string, parameters: Record<string, Plist>) => ({ WFWorkflowActionIdentifier: `is.workflow.actions.${id}`, WFWorkflowActionParameters: parameters })
const duration = (magnitude: number, unit: 'days' | 'sec') => ({ Value: { Magnitude: String(magnitude), Unit: unit }, WFSerializationType: 'WFQuantityFieldValue' })

/** Stable UUIDs, so the same address always builds the same plist. */
const uuid = (n: number) => `5A1DE000-0000-4000-8000-${n.toString(16).toUpperCase().padStart(12, '0')}`

/** Find Health Samples of one type started yesterday, as one sample per day; empty when Health has none. */
function findYesterday(id: string, type: string, from: Output, to: Output) {
  return action('filter.health.quantity', {
    UUID: id,
    WFContentItemFilter: {
      Value: {
        WFActionParameterFilterPrefix: 1,
        WFContentPredicateBoundedDate: false,
        WFActionParameterFilterTemplates: [
          { Bounded: true, Operator: 4, Property: 'Type', Removable: false, Values: { Enumeration: { Value: type, WFSerializationType: 'WFStringSubstitutableState' } } },
          { Bounded: true, Operator: 1003, Property: 'Start Date', Removable: false, Values: { Date: attachment(from), AnotherDate: attachment(to) } },
        ],
      },
      WFSerializationType: 'WFContentPredicateTableTemplate',
    },
    WFHKSampleFilteringGroupBy: 'Day',
    WFHKSampleFilteringFillMissing: false,
  })
}

/** POSTs `{ date, metric, value }`, a flat JSON body, the one request shape Shortcuts builds without nesting. */
function postSample(id: string, postUrl: string, day: Output, metric: ShortcutMetric, value: Output) {
  const field = (type: 0 | 3, key: string, val: Plist) => ({ WFItemType: type, WFKey: plainText(key), WFValue: val })
  return action('downloadurl', {
    UUID: id,
    WFURL: postUrl,
    WFHTTPMethod: 'POST',
    WFHTTPBodyType: 'JSON',
    WFJSONValues: {
      Value: { WFDictionaryFieldValueItems: [field(0, 'date', tokenText(day)), field(0, 'metric', plainText(metric)), field(3, 'value', tokenText(value))] },
      WFSerializationType: 'WFDictionaryFieldValue',
    },
  })
}

/**
 * The unsigned Shortcut: works out yesterday as `yyyy-MM-dd`, then for each metric finds yesterday's samples and, when
 * there are any, posts that day's value to `postUrl`. A metric with no samples sends nothing rather than 0.
 */
export function shortcutFor(postUrl: string): Plist {
  let next = 0
  const id = () => uuid(++next)
  const now = output(id(), 'Date')
  const today = output(id(), 'Start of Today')
  const yesterday = output(id(), 'Yesterday')
  const yesterdayEnd = output(id(), 'End of Yesterday')
  const day = output(id(), 'Formatted Date')
  const dates = [
    action('date', { UUID: now.OutputUUID, WFDateActionMode: 'Current Date' }),
    action('adjustdate', { UUID: today.OutputUUID, WFDate: tokenText(now), WFAdjustOperation: 'Get Start of Day' }),
    action('adjustdate', { UUID: yesterday.OutputUUID, WFDate: tokenText(today), WFAdjustOperation: 'Subtract', WFDuration: duration(1, 'days') }),
    action('adjustdate', { UUID: yesterdayEnd.OutputUUID, WFDate: tokenText(today), WFAdjustOperation: 'Subtract', WFDuration: duration(1, 'sec') }),
    action('format.date', { UUID: day.OutputUUID, WFDate: tokenText(yesterday), WFDateFormatStyle: 'Custom', WFDateFormat: 'yyyy-MM-dd' }),
  ]
  const perMetric = (Object.entries(SHORTCUT_HEALTH_TYPES) as [ShortcutMetric, string][]).flatMap(([metric, type]) => {
    const samples = output(id(), 'Health Samples')
    const group = id()
    return [
      findYesterday(samples.OutputUUID, type, yesterday, yesterdayEnd),
      action('conditional', { GroupingIdentifier: group, WFControlFlowMode: 0, WFCondition: 100, WFInput: { Type: 'Variable', Variable: attachment(samples) } }),
      postSample(id(), postUrl, day, metric, samples),
      action('conditional', { GroupingIdentifier: group, WFControlFlowMode: 2 }),
    ]
  })
  return {
    WFWorkflowClientVersion: '2602.0.5',
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: '900',
    WFWorkflowIcon: { WFWorkflowIconStartColor: 4282601983, WFWorkflowIconGlyphNumber: 59511 },
    WFWorkflowTypes: [],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowImportQuestions: [],
    WFWorkflowActions: [...dates, ...perMetric],
  }
}

const run = promisify(execFile)

/** Signs with the Mac's `shortcuts` tool, so any iPhone imports it. Throws where there is no such tool or it fails. */
async function sign(plist: Plist): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'plano-shortcut-'))
  try {
    await writeFile(join(dir, 'in.json'), JSON.stringify(plist))
    await run('plutil', ['-convert', 'binary1', '-o', join(dir, 'in.shortcut'), join(dir, 'in.json')])
    await run('shortcuts', ['sign', '--mode', 'anyone', '--input', join(dir, 'in.shortcut'), '--output', join(dir, 'out.shortcut')])
    return await readFile(join(dir, 'out.shortcut'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const signed = new Map<string, Promise<Buffer>>()

/** The signed Shortcut for `postUrl`. Signing takes seconds, so each address is signed once while the server runs. */
export function signedShortcut(postUrl: string): Promise<Buffer> {
  let file = signed.get(postUrl)
  if (!file) {
    file = sign(shortcutFor(postUrl))
    file.catch(() => signed.delete(postUrl))
    signed.set(postUrl, file)
  }
  return file
}
