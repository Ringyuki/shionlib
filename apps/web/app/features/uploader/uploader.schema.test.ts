import { describe, expect, it } from 'vitest'
import { firstListing } from './uploader'
import { listingFrom } from './uploader.schema'

const read = (search: string, page = 1) => listingFrom(new URLSearchParams(search), page)

describe('listingFrom', () => {
  it('starts from the first listing', () => {
    expect(read('')).toEqual(firstListing)
  })

  it('reads the stage, the search, the order and the page', () => {
    expect(read('status=published&q=%20sakura%20&sort=downloads&order=asc', 4)).toEqual({
      stage: 'published',
      search: 'sakura',
      sort: 'downloads',
      ascending: true,
      page: 4,
    })
  })

  it('falls back on what it does not know', () => {
    expect(read(`status=deleted&sort=size&order=up&q=${'a'.repeat(101)}`)).toEqual(firstListing)
  })
})
