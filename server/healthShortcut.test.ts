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

  it('posts each metric the value of the Health type it found, as a number', () => {
    const sent = posts.map((post) => {
      const value = jsonField(post, 'value')
      const find = byUuid(actions, tokenUuid(value.WFValue))
      const [typeRow] = find.WFWorkflowActionParameters.WFContentItemFilter.Value.WFActionParameterFilterTemplates
      return [jsonField(post, 'metric').WFValue.Value.string, typeRow.Values.Enumeration.Value, value.WFItemType, find.WFWorkflowActionParameters.WFHKSampleFilteringGroupBy]
    })
    expect(sent).toEqual([
      ['standMinutes', 'Stand Time', 3, 'Day'],
      ['steps', 'Steps', 3, 'Day'],
      ['activeEnergy', 'Active Calories', 3, 'Day'],
      ['exerciseMinutes', 'Exercise Time', 3, 'Day'],
      ['restingHeartRate', 'Resting Heart Rate', 3, 'Day'],
    ])
  })

  it('sends a metric only inside an If that its samples have any value', () => {
    for (const post of posts) {
      const i = actions.indexOf(post)
      const [opening, closing] = [actions[i - 1].WFWorkflowActionParameters, actions[i + 1].WFWorkflowActionParameters]
      expect([opening.WFCondition, opening.WFControlFlowMode, closing.WFControlFlowMode, opening.GroupingIdentifier === closing.GroupingIdentifier]).toEqual([100, 0, 2, true])
      expect(tokenUuid(opening.WFInput.Variable)).toBe(tokenUuid(jsonField(post, 'value').WFValue))
    }
  })

  it('dates every value yesterday, as yyyy-MM-dd, and finds samples that started between its start and its last second', () => {
    const format = byUuid(actions, tokenUuid(jsonField(posts[0], 'date').WFValue)).WFWorkflowActionParameters
    const yesterday = byUuid(actions, tokenUuid(format.WFDate)).WFWorkflowActionParameters
    const startOfToday = byUuid(actions, tokenUuid(yesterday.WFDate)).WFWorkflowActionParameters
    const now = byUuid(actions, tokenUuid(startOfToday.WFDate)).WFWorkflowActionParameters
    expect([format.WFDateFormatStyle, format.WFDateFormat]).toEqual(['Custom', 'yyyy-MM-dd'])
    expect([yesterday.WFAdjustOperation, yesterday.WFDuration.Value]).toEqual(['Subtract', { Magnitude: '1', Unit: 'days' }])
    expect([startOfToday.WFAdjustOperation, now.WFDateActionMode]).toEqual(['Get Start of Day', 'Current Date'])

    const [, dateRow] = byUuid(actions, tokenUuid(jsonField(posts[0], 'value').WFValue)).WFWorkflowActionParameters.WFContentItemFilter.Value.WFActionParameterFilterTemplates
    const end = byUuid(actions, tokenUuid(dateRow.Values.AnotherDate)).WFWorkflowActionParameters
    expect([dateRow.Property, dateRow.Operator, tokenUuid(dateRow.Values.Date)]).toEqual(['Start Date', 1003, yesterday.UUID])
    expect([tokenUuid(end.WFDate), end.WFAdjustOperation, end.WFDuration.Value]).toEqual([startOfToday.UUID, 'Subtract', { Magnitude: '1', Unit: 'sec' }])
  })
})
