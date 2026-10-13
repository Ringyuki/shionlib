import { describe, expect, it } from 'vitest'
import { changesOf, draftOf, protocolsFor, routeName, unchanged } from './admin-ai-route'
import { route } from './admin-ai-route-testing'

describe('protocolsFor', () => {
  const every = ['chat', 'responses', 'messages', 'gemini', 'moderation']

  it('keeps the moderation protocol for moderation models', () => {
    expect(protocolsFor(every, false)).toEqual(['chat', 'responses', 'messages', 'gemini'])
    expect(protocolsFor(every, true)).toEqual(['moderation'])
    expect(protocolsFor(['responses', 'moderation'], false)).toEqual(['responses'])
    expect(protocolsFor(null, false)).toEqual([])
  })
})

describe('changesOf', () => {
  const current = route(1)

  it('is empty while nothing was edited', () => {
    expect(unchanged(changesOf(current, draftOf(current)))).toBe(true)
  })

  it('sends only the fields that differ', () => {
    const draft = {
      ...draftOf(current),
      upstreamId: ' gpt-5-mini ',
      protocol: 'responses' as const,
    }
    expect(changesOf(current, draft)).toEqual({ upstreamId: 'gpt-5-mini', protocol: 'responses' })
  })

  it('turns the switch into a status and leaves a suspended route suspended', () => {
    expect(changesOf(current, { ...draftOf(current), enabled: false })).toEqual({
      status: 'disabled',
    })
    const suspended = route(2, { status: 'suspended' })
    expect(unchanged(changesOf(suspended, draftOf(suspended)))).toBe(true)
    const disabled = route(3, { status: 'disabled' })
    expect(changesOf(disabled, { ...draftOf(disabled), enabled: true })).toEqual({
      status: 'active',
    })
  })

  it('sends prices only while they are set by hand', () => {
    const priced = { ...draftOf(current), priceManual: true, inputPrice: 0.5, outputPrice: 2 }
    expect(changesOf(current, priced)).toEqual({ priceManual: true, inputPrice: 0.5 })
    expect(changesOf(current, { ...draftOf(current), inputPrice: 9 })).toEqual({})
    const manual = route(4, { price_manual: true })
    expect(changesOf(manual, { ...draftOf(manual), priceManual: false, inputPrice: 9 })).toEqual({
      priceManual: false,
    })
  })
})

describe('routeName', () => {
  it('names the model and the provider', () => {
    expect(routeName(route(1))).toBe('gpt-5-mini · OpenRouter')
  })
})
