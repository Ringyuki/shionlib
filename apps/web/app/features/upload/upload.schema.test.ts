import { describe, expect, it } from 'vitest'
import { documentOfText } from '~/shared/richtext/rich-text'
import { clientFrom, savedStateFrom } from './upload.schema'

describe('clientFrom', () => {
  it('reads the identity this browser saved and nothing else', () => {
    const client = '3f0c1f6e-5a52-4f0b-9d5e-0a8f4f6f7a11'
    expect(clientFrom(JSON.stringify(client))).toBe(client)
    expect(clientFrom(null)).toBe('')
    expect(clientFrom('"not an id"')).toBe('')
    expect(clientFrom('{')).toBe('')
  })
})

describe('savedStateFrom', () => {
  it('starts empty when nothing usable was saved', () => {
    expect(savedStateFrom(null)).toEqual({ submissions: [], uploads: [] })
    expect(savedStateFrom('{"submissions":1}')).toEqual({ submissions: [], uploads: [] })
  })

  it('keeps a resource whose note was saved as text before notes became documents', () => {
    const saved = (note: unknown) =>
      JSON.stringify({
        submissions: [
          {
            id: 's1',
            target: {
              kind: 'create',
              gameId: 7,
              resource: { platform: ['win'], language: ['jp'], note, form: 'portable' },
            },
            label: 'game.7z',
            submitting: false,
          },
        ],
        uploads: [],
      })
    const resourceOf = (stored: string) => {
      const [submission] = savedStateFrom(stored).submissions
      return submission?.target.kind === 'create' ? submission.target.resource : undefined
    }
    const note = documentOfText('DL版')
    expect(resourceOf(saved('DL版'))?.note).toEqual(note)
    expect(resourceOf(saved(note))?.note).toEqual(note)
    expect(resourceOf(saved({ type: 'doc', content: [{ type: 'heading' }] }))).toBeUndefined()
  })
})
