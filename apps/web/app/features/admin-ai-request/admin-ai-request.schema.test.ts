import { describe, expect, it } from 'vitest'
import { filterFrom, prettyJson } from './admin-ai-request.schema'

describe('filterFrom', () => {
  it('reads every filter from the address', () => {
    const search = new URLSearchParams(
      'range=7d&source=scene&scene=moderation_review&model=2&provider=1&result=failed&error=quota&id=310',
    )
    expect(filterFrom(search, 3)).toEqual({
      range: '7d',
      source: 'scene',
      scene: 'moderation_review',
      modelId: 2,
      providerId: 1,
      result: 'failed',
      errorKind: 'quota',
      page: 3,
      opened: '310',
    })
  })

  it('ignores what it does not understand', () => {
    expect(
      filterFrom(new URLSearchParams('range=1y&source=cron&model=x&error=typo&id=abc'), 1),
    ).toEqual({
      range: '24h',
      source: undefined,
      scene: undefined,
      modelId: undefined,
      providerId: undefined,
      result: undefined,
      errorKind: undefined,
      page: 1,
      opened: undefined,
    })
  })
})

describe('prettyJson', () => {
  it('indents JSON and leaves other text alone', () => {
    expect(prettyJson('{"decision":"REVIEW","score":0.64}')).toBe(
      '{\n  "decision": "REVIEW",\n  "score": 0.64\n}',
    )
    expect(prettyJson('这是一段文本')).toBe('这是一段文本')
  })
})
