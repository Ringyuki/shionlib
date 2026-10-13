import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { loadChoices, runPlayground } from './admin-ai-playground.use-cases'

describe('loadChoices', () => {
  it('offers nothing while the gateway is empty', async () => {
    const fake = fakeApi().on('get', '/admin/ai/scenes', null).on('get', '/admin/ai/models', null)
    await expect(loadChoices(fake.api)).resolves.toEqual({ scenes: [], models: [] })
  })
})

describe('runPlayground', () => {
  const answered = { ok: true, output: '你好', error: null, attempts: [] }

  it('sends one target with only the parameters that were set', async () => {
    const fake = fakeApi().on('post', '/admin/ai/playground/runs', { results: [answered] })
    const reply = await runPlayground(fake.api, {
      target: { kind: 'scene', id: 'moderation_review' },
      messages: [{ role: 'user', content: '你好' }],
      system: '  ',
      temperature: null,
      maxOutputTokens: 200,
      schema: null,
    })
    expect(reply).toEqual(answered)
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      targets: [{ kind: 'scene', id: 'moderation_review' }],
      messages: [{ role: 'user', content: '你好' }],
      max_output_tokens: 200,
    })
  })

  it('sends the schema as an object', async () => {
    const fake = fakeApi().on('post', '/admin/ai/playground/runs', { results: null })
    const reply = await runPlayground(fake.api, {
      target: { kind: 'model', id: '2' },
      messages: [{ role: 'user', content: '你好' }],
      system: '只回答 JSON',
      temperature: 0,
      maxOutputTokens: null,
      schema: '{"type":"object"}',
    })
    expect(reply).toBeNull()
    await expect(fake.requests[0]?.json()).resolves.toMatchObject({
      system: '只回答 JSON',
      temperature: 0,
      schema: { type: 'object' },
    })
  })
})
