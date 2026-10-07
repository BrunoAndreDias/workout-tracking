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
 * app's label (see docs/research/ios-shortcut-plist.md). All are quantity types, so grouping by day sums the
 * cumulative ones and averages resting heart rate.
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
const REPEAT_ITEM = { Type: 'Variable', VariableName: 'Repeat Item' } as const
const repeatItem = { Value: REPEAT_ITEM, WFSerializationType: 'WFTextTokenAttachment' }
const repeatItemText = { Value: { string: OBJECT_REPLACEMENT, attachmentsByRange: { '{0, 1}': REPEAT_ITEM } }, WFSerializationType: 'WFTextTokenString' }

/** Days posted besides today. */
const DAYS_BEFORE_TODAY = 14

/** Stable UUIDs, so the same address always builds the same plist. */
const uuid = (n: number) => `5A1DE000-0000-4000-8000-${n.toString(16).toUpperCase().padStart(12, '0')}`

/**
 * Find Health Samples of one type, one sample per day. The 15-day window can start mid-day, so its oldest day may be
 * partial. There is no sort or limit, because the limit counts raw samples before the grouping. The If around the POST
 * skips that first day by date.
 */
function findRecentDays(id: string, type: string) {
  const window = DAYS_BEFORE_TODAY + 1
  return action('filter.health.quantity', {
    UUID: id,
    WFContentItemFilter: {
      Value: {
        WFActionParameterFilterPrefix: 1,
        WFContentPredicateBoundedDate: false,
        WFActionParameterFilterTemplates: [
          { Bounded: true, Operator: 4, Property: 'Type', Removable: false, Values: { Enumeration: { Value: type, WFSerializationType: 'WFStringSubstitutableState' } } },
          { Bounded: true, Operator: 1001, Property: 'Start Date', Removable: false, Values: { Unit: 16, Number: String(window) } },
        ],
      },
      WFSerializationType: 'WFContentPredicateTableTemplate',
    },
    WFHKSampleFilteringGroupBy: 'Day',
    WFHKSampleFilteringFillMissing: false,
  })
}

/** POSTs `{ date, metric, value }`, a flat JSON body, the one request shape Shortcuts builds without nesting. */
function postSample(id: string, postUrl: string, day: Output, metric: ShortcutMetric) {
  const field = (type: 0 | 3, key: string, val: Plist) => ({ WFItemType: type, WFKey: plainText(key), WFValue: val })
  return action('downloadurl', {
    UUID: id,
    WFURL: postUrl,
    WFHTTPMethod: 'POST',
    WFHTTPBodyType: 'JSON',
    WFJSONValues: {
      Value: { WFDictionaryFieldValueItems: [field(0, 'date', tokenText(day)), field(0, 'metric', plainText(metric)), field(3, 'value', repeatItemText)] },
      WFSerializationType: 'WFDictionaryFieldValue',
    },
  })
}

/** Date, Adjust Date and Format Date, once at the top: the window's first day as yyyy-MM-dd, 15 days back. */
function windowFirstDay(ids: [string, string, string]) {
  const [now, back, firstDay] = [output(ids[0], 'Date'), output(ids[1], 'Adjusted Date'), output(ids[2], 'Formatted Date')]
  const actions = [
    action('date', { UUID: now.OutputUUID, WFDateActionMode: 'Current Date' }),
    action('adjustdate', {
      UUID: back.OutputUUID,
      WFDate: tokenText(now),
      WFAdjustOperation: 'Subtract',
      WFDuration: { Value: { Magnitude: String(DAYS_BEFORE_TODAY + 1), Unit: 'days' }, WFSerializationType: 'WFQuantityFieldValue' },
    }),
    action('format.date', { UUID: firstDay.OutputUUID, WFDate: tokenText(back), WFDateFormatStyle: 'Custom', WFDateFormat: 'yyyy-MM-dd' }),
  ]
  return { actions, firstDay }
}

/**
 * The unsigned Shortcut: for each metric, finds today and the 14 days before as one sample per day and posts each day's
 * value to `postUrl`, skipping the window's first day, which can be partial. A day with no samples sends nothing rather
 * than 0.
 */
export function shortcutFor(postUrl: string): Plist {
  let next = 0
  const id = () => uuid(++next)
  const { actions: preamble, firstDay } = windowFirstDay([id(), id(), id()])
  const perMetric = (Object.entries(SHORTCUT_HEALTH_TYPES) as [ShortcutMetric, string][]).flatMap(([metric, type]) => {
    const samples = output(id(), 'Health Samples')
    const startDate = output(id(), 'Details of Health Samples')
    const day = output(id(), 'Formatted Date')
    const group = id()
    const skip = id()
    return [
      findRecentDays(samples.OutputUUID, type),
      action('repeat.each', { GroupingIdentifier: group, WFControlFlowMode: 0, WFInput: attachment(samples) }),
      action('properties.health.quantity', { UUID: startDate.OutputUUID, WFContentItemPropertyName: 'Start Date', WFInput: repeatItem }),
      action('format.date', { UUID: day.OutputUUID, WFDate: tokenText(startDate), WFDateFormatStyle: 'Custom', WFDateFormat: 'yyyy-MM-dd' }),
      action('conditional', {
        GroupingIdentifier: skip,
        WFControlFlowMode: 0,
        WFCondition: 5,
        WFInput: { Type: 'Variable', Variable: attachment(day) },
        WFConditionalActionString: tokenText(firstDay),
      }),
      postSample(id(), postUrl, day, metric),
      action('conditional', { GroupingIdentifier: skip, UUID: id(), WFControlFlowMode: 2 }),
      action('repeat.each', { GroupingIdentifier: group, UUID: id(), WFControlFlowMode: 2 }),
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
    WFWorkflowActions: [...preamble, ...perMetric],
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
