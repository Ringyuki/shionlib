import { validate } from 'class-validator'
import { getEditorTextLength, MaxEditorLength } from './max-editor-length.decorator'
import type { SerializedEditorState } from 'lexical'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeState(...paragraphs: string[][]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children: paragraphs.map(texts => ({
        type: 'paragraph',
        version: 1,
        children: texts.map(text => ({ type: 'text', version: 1, text })),
      })),
    },
  } as unknown as SerializedEditorState
}

class TestDto {
  @MaxEditorLength(10)
  content: Record<string, any>
}

// ── getEditorTextLength ───────────────────────────────────────────────────────

describe('getEditorTextLength', () => {
  it('returns 0 for an empty editor state', () => {
    expect(getEditorTextLength(makeState())).toBe(0)
  })

  it('counts characters in a single text node', () => {
    expect(getEditorTextLength(makeState(['hello']))).toBe(5)
  })

  it('concatenates multiple text nodes within one paragraph', () => {
    // "foo" + "bar" → 6
    expect(getEditorTextLength(makeState(['foo', 'bar']))).toBe(6)
  })

  it('concatenates text across multiple paragraphs', () => {
    // "hello" + "world" → 10
    expect(getEditorTextLength(makeState(['hello'], ['world']))).toBe(10)
  })

  it('returns 0 for non-text leaf nodes (e.g. image)', () => {
    const state = {
      root: {
        type: 'root',
        version: 1,
        children: [{ type: 'image', version: 1, src: 'x.png' }],
      },
    } as unknown as SerializedEditorState

    expect(getEditorTextLength(state)).toBe(0)
  })

  it('handles deeply nested structures', () => {
    const state = {
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [
              {
                type: 'link',
                version: 1,
                children: [{ type: 'text', version: 1, text: 'click' }],
              },
            ],
          },
        ],
      },
    } as unknown as SerializedEditorState

    expect(getEditorTextLength(state)).toBe(5)
  })
})

// ── MaxEditorLength decorator ─────────────────────────────────────────────────

describe('MaxEditorLength decorator', () => {
  it('passes when text length is within the limit', async () => {
    const dto = Object.assign(new TestDto(), { content: makeState(['short']) })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('passes when text length equals the limit exactly', async () => {
    const dto = Object.assign(new TestDto(), { content: makeState(['0123456789']) }) // 10 chars
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when text length exceeds the limit', async () => {
    const dto = Object.assign(new TestDto(), { content: makeState(['01234567890']) }) // 11 chars
    const errors = await validate(dto)
    expect(errors).toHaveLength(1)
    expect(errors[0].constraints).toHaveProperty('maxEditorLength')
  })

  it('fails for null', async () => {
    const dto = Object.assign(new TestDto(), { content: null })
    const errors = await validate(dto)
    expect(errors[0].constraints).toHaveProperty('maxEditorLength')
  })

  it('fails for a primitive value', async () => {
    const dto = Object.assign(new TestDto(), { content: 'plain string' })
    const errors = await validate(dto)
    expect(errors[0].constraints).toHaveProperty('maxEditorLength')
  })

  it('defaultMessage includes property name and limit', async () => {
    const dto = Object.assign(new TestDto(), { content: makeState(['01234567890']) })
    const errors = await validate(dto)
    const msg = errors[0].constraints?.maxEditorLength ?? ''
    expect(msg).toContain('content')
    expect(msg).toContain('10')
  })
})
