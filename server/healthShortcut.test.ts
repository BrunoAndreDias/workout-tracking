import { describe, expect, it } from 'vitest'
import { shortcutFor } from './healthShortcut.ts'

const POST_URL = 'http://192.168.1.5:4173/api/health'

interface Action {
  WFWorkflowActionIdentifier: string
  WFWorkflowActionParameters: Record<string, any>
}

const actionsOf = (postUrl: string) => (shortcutFor(postUrl) as unknown as { WFWorkflowActions: Action[] }).WFWorkflowActions
const byUuid = (actions: Action[], uuid: string) => actions.find((a) => a.WFWorkflowActionParameters.UUID === uuid)!
const tokenUuid = (field: any): string => (field.Value.attachmentsByRange?.['{0, 1}'] ?? field.Value).OutputUUID
const jsonField = (post: Action, key: string) => post.WFWorkflowActionParameters.WFJSONValues.Value.WFDictionaryFieldValueItems.find((f: any) => f.WFKey.Value.string === key)

describe('shortcutFor', () => {
  const actions = actionsOf(POST_URL)
  const posts = actions.filter((a) => a.WFWorkflowActionIdentifier === 'is.workflow.actions.downloadurl')

  it('POSTs JSON to the address it was built for, once per metric it reads', () => {
    expect(posts.map((p) => [p.WFWorkflowActionParameters.WFURL, p.WFWorkflowActionParameters.WFHTTPMethod, p.WFWorkflowActionParameters.WFHTTPBodyType])).toEqual(
      Array(5).fill([POST_URL, 'POST', 'JSON']),
    )
    expect(JSON.stringify(actionsOf('https://mac.tail1234.ts.net/api/health'))).toContain('"WFURL":"https://mac.tail1234.ts.net/api/health"')
  })

  const loopOf = (post: Action) => {
    const i = actions.indexOf(post)
    const start = actions.slice(0, i).reverse().find((a) => a.WFWorkflowActionIdentifier === 'is.workflow.actions.repeat.each')!
    const end = actions.slice(i + 1).find((a) => a.WFWorkflowActionIdentifier === 'is.workflow.actions.repeat.each')!
    return { start: start.WFWorkflowActionParameters, end: end.WFWorkflowActionParameters, inside: actions.slice(actions.indexOf(start) + 1, actions.indexOf(end)) }
  }
  const repeatItem = { Type: 'Variable', VariableName: 'Repeat Item' }

  it('posts each metric once per day found, inside a Repeat with Each over that metric\'s Health type', () => {
    const sent = posts.map((post) => {
      const { start, end } = loopOf(post)
      const find = byUuid(actions, tokenUuid(start.WFInput))
      const [typeRow] = find.WFWorkflowActionParameters.WFContentItemFilter.Value.WFActionParameterFilterTemplates
      expect([start.WFControlFlowMode, end.WFControlFlowMode, start.GroupingIdentifier === end.GroupingIdentifier]).toEqual([0, 2, true])
      return [jsonField(post, 'metric').WFValue.Value.string, typeRow.Values.Enumeration.Value]
    })
    expect(sent).toEqual([
      ['standMinutes', 'Stand Time'],
      ['steps', 'Steps'],
      ['activeEnergy', 'Active Calories'],
      ['exerciseMinutes', 'Exercise Time'],
      ['restingHeartRate', 'Resting Heart Rate'],
    ])
  })

  it('finds the last 15 days as one sample per day, newest first, keeping 15 so the partial oldest day drops', () => {
    for (const post of posts) {
      const find = byUuid(actions, tokenUuid(loopOf(post).start.WFInput)).WFWorkflowActionParameters
      const [, windowRow] = find.WFContentItemFilter.Value.WFActionParameterFilterTemplates
      expect(windowRow).toEqual({ Bounded: true, Operator: 1001, Property: 'Start Date', Removable: false, Values: { Unit: 16, Number: '15' } })
      expect([find.WFHKSampleFilteringGroupBy, find.WFHKSampleFilteringFillMissing, find.WFContentItemSortProperty, find.WFContentItemSortOrder, find.WFContentItemLimitEnabled, find.WFContentItemLimitNumber]).toEqual([
        'Day',
        false,
        'Start Date',
        'Latest First',
        true,
        15,
      ])
    }
  })

  it('dates each post with its day sample\'s Start Date as yyyy-MM-dd, and sends the day sample as the value', () => {
    for (const post of posts) {
      const format = byUuid(actions, tokenUuid(jsonField(post, 'date').WFValue)).WFWorkflowActionParameters
      const details = byUuid(actions, tokenUuid(format.WFDate)).WFWorkflowActionParameters
      expect([format.WFDateFormatStyle, format.WFDateFormat]).toEqual(['Custom', 'yyyy-MM-dd'])
      expect([details.WFContentItemPropertyName, details.WFInput.Value]).toEqual(['Start Date', repeatItem])
      const value = jsonField(post, 'value')
      expect([value.WFItemType, value.WFValue.Value.attachmentsByRange['{0, 1}']]).toEqual([3, repeatItem])
      expect(loopOf(post).inside).toContain(byUuid(actions, details.UUID))
    }
  })

  it('has no date arithmetic and no If, since a day with no samples is never looped over', () => {
    const ids = new Set(actions.map((a) => a.WFWorkflowActionIdentifier.replace('is.workflow.actions.', '')))
    expect([...ids].sort()).toEqual(['downloadurl', 'filter.health.quantity', 'format.date', 'properties.health.quantity', 'repeat.each'])
  })
})
