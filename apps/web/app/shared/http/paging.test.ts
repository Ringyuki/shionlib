import { describe, expect, it } from 'vitest'
import { lastPage, searchAtPage } from './paging'

describe('lastPage', () => {
  it('counts the pages a total fills and never fewer than one', () => {
    expect(lastPage(0, 20)).toBe(1)
    expect(lastPage(20, 20)).toBe(1)
    expect(lastPage(21, 20)).toBe(2)
  })
})

describe('searchAtPage', () => {
  it('names later pages and leaves the first page out of the address', () => {
    expect(searchAtPage('', 3)).toBe('?page=3')
    expect(searchAtPage('?page=3', 1)).toBe('')
  })

  it('keeps what else the address says', () => {
    expect(searchAtPage('?q=yuzu&page=9', 2)).toBe('?q=yuzu&page=2')
    expect(searchAtPage('?q=yuzu&page=9', 1)).toBe('?q=yuzu')
  })
})
