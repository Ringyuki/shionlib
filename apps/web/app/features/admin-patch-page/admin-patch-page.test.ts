import { describe, expect, it } from 'vitest'
import {
  addressOf,
  draftOf,
  full,
  listed,
  maxPages,
  nameOf,
  shownPages,
  withoutPage,
  withPage,
  type PatchPage,
  type PatchPages,
} from './admin-patch-page'

const page = (id: string, title: string | null = null): PatchPage => ({
  id,
  url: `https://www.moyu.moe/galgame/${id}`,
  title,
  resources: 1,
  via: null,
})

const original = page('3125', '俺たちに翼はない')
const edition = page('215305', '俺たちに翼はない R')

const found: PatchPages = {
  manual: false,
  vndb_id: 'v1141',
  bangumi_id: '15004',
  matched: [original, edition],
  assigned: null,
}

describe('draftOf', () => {
  it('starts an assignment by hand from what the ids found', () => {
    expect(draftOf(found)).toEqual({ manual: false, assigned: [original, edition] })
  })

  it('keeps the pages assigned by hand', () => {
    expect(draftOf({ ...found, manual: true, assigned: [edition] })).toEqual({
      manual: true,
      assigned: [edition],
    })
    expect(draftOf({ ...found, manual: true, assigned: null })).toEqual({
      manual: true,
      assigned: [],
    })
  })
})

describe('shownPages', () => {
  it('shows what the ids find until the pages are assigned by hand', () => {
    const draft = { manual: false, assigned: [edition] }
    expect(shownPages(found, draft)).toEqual([original, edition])
    expect(shownPages(found, { ...draft, manual: true })).toEqual([edition])
    expect(shownPages({ ...found, matched: null }, draft)).toEqual([])
  })
})

describe('the pages assigned by hand', () => {
  it('are added at the end and removed by their number', () => {
    const draft = withPage({ manual: true, assigned: [original] }, edition)
    expect(draft.assigned).toEqual([original, edition])
    expect(listed(draft, '215305')).toBe(true)
    expect(withoutPage(draft, '3125').assigned).toEqual([edition])
    expect(listed(withoutPage(draft, '215305'), '215305')).toBe(false)
  })

  it('are limited in number', () => {
    const many = Array.from({ length: maxPages }, (_, index) => page(String(index + 1)))
    expect(full({ manual: true, assigned: many.slice(1) })).toBe(false)
    expect(full({ manual: true, assigned: many })).toBe(true)
  })
})

describe('a page', () => {
  it('is named after its work, else by its address', () => {
    expect(addressOf(original)).toBe('www.moyu.moe/galgame/3125')
    expect(nameOf(original)).toBe('俺たちに翼はない')
    expect(nameOf(page('212857'))).toBe('www.moyu.moe/galgame/212857')
  })
})
