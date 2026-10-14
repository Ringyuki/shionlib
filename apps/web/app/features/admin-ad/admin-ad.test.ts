import { describe, expect, it } from 'vitest'
import {
  blankAd,
  draftOf,
  fits,
  hostOf,
  previewOf,
  rateOf,
  searchOf,
  valuesOf,
  withImages,
  type AdminAd,
} from './admin-ad'

const stored: AdminAd = {
  id: 4,
  name: 'DZMM',
  link: 'https://s.himoe.uk/dzmm',
  banner: 'spotlight/banner/d.webp',
  banner_adult: true,
  side_image: 'spotlight/side/d.webp',
  side_icon: 'spotlight/icon/d.webp',
  side_adult: false,
  slots: ['home', 'sidebar'],
  languages: ['zh', 'ja'],
  weight: 7,
  enabled: true,
  status: 'running',
  start_at: '2026-10-14T16:00:00.000Z',
  end_at: null,
  week: { views: 0, clicks: 0 },
  created: '2026-10-01T00:00:00.000Z',
  updated: '2026-10-01T00:00:00.000Z',
}

describe('searchOf', () => {
  it('keeps only what differs from the defaults', () => {
    expect(searchOf({ status: undefined, slot: undefined, ad: undefined, days: '30' })).toBe('')
    expect(searchOf({ status: 'ended', slot: 'sidebar', ad: 3, days: '7' })).toBe(
      '?status=ended&slot=sidebar&ad=3&days=7',
    )
  })
})

describe('valuesOf and draftOf', () => {
  it('edit times on the site clock and send them back as the same instants', () => {
    const values = valuesOf(stored)
    expect(values.startAt).toBe('2026-10-15T00:00')
    const draft = draftOf(values)
    expect(new Date(draft.start_at ?? '').toISOString()).toBe('2026-10-14T16:00:00.000Z')
    expect(draft.end_at).toBeNull()
  })

  it('send slots and languages in a fixed order and trim the texts', () => {
    const draft = draftOf({
      ...valuesOf(stored),
      name: '  DZMM ',
      slots: ['sidebar', 'home'],
      languages: ['ja', 'zh'],
    })
    expect(draft).toMatchObject({
      name: 'DZMM',
      slots: ['home', 'sidebar'],
      languages: ['zh', 'ja'],
    })
  })

  it('drop slots and adult marks that have no image to go with them', () => {
    const draft = draftOf({ ...blankAd, banner: null, bannerAdult: true, slots: ['game'] })
    expect(draft).toMatchObject({ banner_adult: false, slots: [] })
  })
})

describe('withImages', () => {
  it('forgets the slots and the adult mark of an image that was removed', () => {
    const values = withImages(valuesOf(stored), { sideImage: null })
    expect(values.slots).toEqual(['home'])
    expect(withImages(valuesOf(stored), { banner: null })).toMatchObject({
      bannerAdult: false,
      slots: ['sidebar'],
    })
  })
})

describe('fits', () => {
  it('needs the banner for page slots and both sidebar images for the sidebar', () => {
    const side = { banner: null, sideImage: 'spotlight/side/a.webp', sideIcon: null }
    expect(fits(side, 'sidebar')).toBe(false)
    expect(fits({ ...side, sideIcon: 'spotlight/icon/a.webp' }, 'sidebar')).toBe(true)
    expect(fits(side, 'download')).toBe(false)
  })
})

describe('rateOf', () => {
  it('has no rate without views', () => {
    expect(rateOf({ views: 0, clicks: 0 })).toBeUndefined()
    expect(rateOf({ views: 200, clicks: 3 })).toBe(0.015)
  })
})

describe('hostOf and previewOf', () => {
  it('show the host of the link and the banner before the sidebar pictures', () => {
    expect(hostOf('https://v2.lovenao.pro/#/register')).toBe('v2.lovenao.pro')
    expect(hostOf('not a link')).toBe('not a link')
    expect(previewOf(stored)).toBe('spotlight/banner/d.webp')
    expect(previewOf({ ...stored, banner: null })).toBe('spotlight/icon/d.webp')
  })
})
