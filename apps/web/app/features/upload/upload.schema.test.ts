import { describe, expect, it } from 'vitest'
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
})
