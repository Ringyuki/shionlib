import { describe, expect, it } from 'vitest'
import {
  changeOf,
  costBars,
  providerUsage,
  requestBars,
  sceneUsage,
  spansDays,
  type BreakdownRow,
  type CostSeries,
} from './admin-ai-overview'
import { provider, scene, stats } from './admin-ai-testing'

const row = (key: string, changes: Partial<BreakdownRow> = {}): BreakdownRow => ({
  key,
  label: key,
  routes: [],
  requests: 0,
  failures: 0,
  first_token_ms: null,
  cost_usd: 0,
  duration_p95_ms: null,
  input_tokens: 0,
  output_tokens: 0,
  ...changes,
})

const series: CostSeries = {
  bucket_ms: 3_600_000,
  buckets: [
    { at: '2026-10-12T05:00:00Z', requests: 61, failures: 2, cost_usd: 0.06, first_token_ms: 400 },
    { at: '2026-10-12T06:00:00Z', requests: 64, failures: 5, cost_usd: 0.07, first_token_ms: 420 },
  ],
  models: [
    { model_id: 2, label: 'gpt-5-mini', costs: [0.05, 0.06] },
    { model_id: null, label: null, costs: [0.01, 0.01] },
  ],
}

describe('sceneUsage', () => {
  it('lists every scene with the usage of the range, zero when it was not called', () => {
    const scenes = [
      scene('moderation_screen', {
        label: '内容审核初筛',
        effective: { id: 1, key: 'omni', name: 'omni-moderation-latest', moderation: true },
      }),
      scene('moderation_review', { label: '内容审核复审' }),
    ]
    const usage = sceneUsage(scenes, [row('moderation_screen', { requests: 1172, failures: 4 })])
    expect(usage).toEqual([
      {
        key: 'moderation_screen',
        label: '内容审核初筛',
        model: 'omni-moderation-latest',
        stats: stats({ requests: 1172, failures: 4 }),
      },
      { key: 'moderation_review', label: '内容审核复审', model: undefined, stats: stats() },
    ])
  })
})

describe('providerUsage', () => {
  it('matches the usage by the number of the provider', () => {
    const [first, second] = providerUsage(
      [provider(1, { base_url: 'https://openrouter.ai/api/v1' }), provider(2)],
      [row('2', { requests: 38, failures: 7, first_token_ms: 1420 })],
    )
    expect(first).toMatchObject({ host: 'openrouter.ai/api/v1', stats: stats() })
    expect(second?.stats).toEqual(stats({ requests: 38, failures: 7, first_token_ms: 1420 }))
  })
})

describe('changeOf', () => {
  it('compares with the range before, when there was one', () => {
    expect(changeOf(12, 0)).toBeUndefined()
    expect(changeOf(112, 100)).toEqual({ direction: 'more', share: 0.12 })
    expect(changeOf(50, 100)).toEqual({ direction: 'less', share: 0.5 })
    expect(changeOf(100, 100)).toEqual({ direction: 'same', share: 0 })
  })
})

describe('the charts', () => {
  it('splits the requests of each bucket into answered and failed', () => {
    expect(requestBars(series, { ok: '成功', failed: '失败' })).toEqual([
      { name: '成功', tone: 'accent', values: [59, 59] },
      { name: '失败', tone: 'danger', values: [2, 5] },
    ])
  })

  it('draws one bar per model and the rest in a neutral tone', () => {
    expect(costBars(series, '其他模型')).toEqual([
      { name: 'gpt-5-mini', tone: 'accent', values: [0.05, 0.06] },
      { name: '其他模型', tone: 'neutral', values: [0.01, 0.01] },
    ])
    expect(costBars({ ...series, models: null }, '其他模型')).toEqual([])
  })

  it('labels the buckets by day from a day upwards', () => {
    expect(spansDays(series)).toBe(false)
    expect(spansDays({ bucket_ms: 86_400_000 })).toBe(true)
  })
})
