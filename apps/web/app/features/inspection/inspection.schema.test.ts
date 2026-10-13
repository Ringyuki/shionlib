import { describe, expect, it } from 'vitest'
import { maxQueryLength } from './inspection'
import { entryIdFrom, wantedPageFrom, wantedViewFrom } from './inspection.schema'

const params = (search: string) => new URLSearchParams(search)

describe('wantedPageFrom', () => {
  it('reads the listing, the folder and the page that are asked for', () => {
    expect(wantedPageFrom(params('inspection=7&parent=12&page=3'))).toEqual({
      inspectionId: 7,
      parent: 12,
      page: 3,
      query: '',
    })
    expect(wantedPageFrom(params('inspection=7&q=%20exe%20'))).toEqual({
      inspectionId: 7,
      parent: null,
      page: 1,
      query: 'exe',
    })
  })

  it('starts at the first page when the page is not a number', () => {
    expect(wantedPageFrom(params('inspection=7&page=x'))?.page).toBe(1)
    expect(wantedPageFrom(params('inspection=7&page=0'))?.page).toBe(1)
  })

  it('refuses a request without a listing or with a folder that is not an id', () => {
    expect(wantedPageFrom(params('parent=3'))).toBeUndefined()
    expect(wantedPageFrom(params('inspection=abc'))).toBeUndefined()
    expect(wantedPageFrom(params('inspection=7&parent=-1'))).toBeUndefined()
  })
})

describe('wantedViewFrom', () => {
  it('reads the chosen file and the filter from the address', () => {
    expect(wantedViewFrom(params('file=8&q=%E8%A8%AD%E5%AE%9A'))).toEqual({
      file: 8,
      query: '設定',
    })
    expect(wantedViewFrom(params(''))).toEqual({ file: null, query: '' })
  })

  it('ignores a file that is not an id and cuts an endless filter', () => {
    expect(wantedViewFrom(params('file=first')).file).toBeNull()
    expect(wantedViewFrom(params(`q=${'a'.repeat(maxQueryLength + 20)}`)).query).toHaveLength(
      maxQueryLength,
    )
  })
})

describe('entryIdFrom', () => {
  it('reads the entry a preview is asked for', () => {
    expect(entryIdFrom(params('entry=16'))).toBe(16)
    expect(entryIdFrom(params('entry=0'))).toBeUndefined()
    expect(entryIdFrom(params(''))).toBeUndefined()
  })
})
