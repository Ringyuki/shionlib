import { describe, expect, it } from 'vitest'
import {
  firstTarget,
  historyOf,
  optionsOf,
  targetLabel,
  totalsOf,
  type Attempt,
  type Choices,
  type Reply,
} from './admin-ai-playground'

const attempt = (changes: Partial<Attempt>): Attempt => ({
  id: '1',
  call_id: 'call',
  source: 'playground',
  scene: null,
  model: null,
  route_id: 1,
  provider: null,
  upstream_id: 'gpt-5-mini',
  protocol: 'chat',
  ok: true,
  error_kind: null,
  error_message: null,
  adaptation: null,
  first_token_ms: 400,
  duration_ms: 1800,
  input_tokens: 40,
  output_tokens: 18,
  cache_read_tokens: 0,
  cost_usd: 0.0004,
  created: '2026-10-12T06:22:00.000Z',
  ...changes,
})

const reply = (changes: Partial<Reply>): Reply => ({
  ok: true,
  output: '你好',
  error: null,
  attempts: [],
  ...changes,
})

const none: Choices = { scenes: [], models: [] }

const scenes: Choices = {
  scenes: [{ key: 'moderation_review', label: '内容审核复审' }],
  models: [],
}

describe('the targets', () => {
  it('offers the scenes first and nothing when the gateway is empty', () => {
    expect(firstTarget(none)).toBeUndefined()
    expect(firstTarget(scenes)).toEqual({ kind: 'scene', id: 'moderation_review' })
    expect(firstTarget(scenes, [{ kind: 'scene', id: 'moderation_review' }])).toBeUndefined()
  })

  it('names a target by its option', () => {
    expect(optionsOf(scenes, 'scene')).toEqual([
      { value: 'moderation_review', label: '内容审核复审' },
    ])
    expect(targetLabel(scenes, { kind: 'scene', id: 'moderation_review' })).toBe('内容审核复审')
    expect(targetLabel(scenes, { kind: 'model', id: '9' })).toBe('')
  })
})

describe('historyOf', () => {
  it('repeats the answered turns before the new message', () => {
    const lane = [
      { message: '第一句', reply: reply({ output: '回答一' }) },
      { message: '失败的一句', reply: reply({ ok: false, output: null }) },
      { message: '还没回答', reply: undefined },
    ]
    expect(historyOf(lane, '第二句')).toEqual([
      { role: 'user', content: '第一句' },
      { role: 'assistant', content: '回答一' },
      { role: 'user', content: '第二句' },
    ])
    expect(historyOf([], '你好')).toEqual([{ role: 'user', content: '你好' }])
  })
})

describe('totalsOf', () => {
  it('reports the attempt that answered and what every attempt cost', () => {
    const totals = totalsOf(
      reply({
        attempts: [attempt({ id: '1', ok: false }), attempt({ id: '2', cost_usd: 0.0006 })],
      }),
    )
    expect(totals.served?.id).toBe('2')
    expect(totals.costUsd).toBeCloseTo(0.001)
    expect(totalsOf(reply({ attempts: null }))).toEqual({ served: undefined, costUsd: 0 })
  })
})
