import { describe, expect, it } from 'vitest'
import { coverOf, hidden, narrowed, searchOf, shown, titlesOf, visible } from './admin-game'

describe('searchOf', () => {
  it('leaves the defaults out of the address', () => {
    expect(searchOf({ query: '', status: undefined, sort: 'views' })).toBe('')
    expect(searchOf({ query: '千恋', status: hidden, sort: 'updated' })).toBe(
      `?${new URLSearchParams({ q: '千恋', status: '2', sort: 'updated' }).toString()}`,
    )
  })
})

describe('narrowed', () => {
  it('tells a search or a status from the whole list', () => {
    expect(narrowed({ query: '', status: undefined })).toBe(false)
    expect(narrowed({ query: '12', status: undefined })).toBe(true)
    expect(narrowed({ query: '', status: visible })).toBe(true)
  })
})

describe('titlesOf', () => {
  it('leads with the original title and adds another that differs', () => {
    expect(titlesOf({ title_jp: 'アマカノ', title_zh: '甜蜜女友', title_en: 'Amakano' })).toEqual({
      main: 'アマカノ',
      other: '甜蜜女友',
    })
    expect(titlesOf({ title_jp: '千恋＊万花', title_zh: '千恋＊万花', title_en: '' })).toEqual({
      main: '千恋＊万花',
      other: undefined,
    })
    expect(titlesOf({ title_jp: '', title_zh: '', title_en: 'euphoria' })).toEqual({
      main: 'euphoria',
      other: undefined,
    })
  })
})

describe('coverOf', () => {
  it('takes the first cover', () => {
    const cover = {
      url: 'game/1/cover.webp',
      dims: [300, 400],
      thumb_hash: null,
      sexual: 0,
      violence: 0,
    }
    expect(coverOf({ covers: [cover] })).toBe(cover)
    expect(coverOf({ covers: null })).toBeUndefined()
  })
})

describe('shown', () => {
  it('follows the status', () => {
    expect(shown({ status: visible })).toBe(true)
    expect(shown({ status: hidden })).toBe(false)
  })
})
