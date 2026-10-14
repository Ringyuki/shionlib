import { describe, expect, it } from 'vitest'
import { adsIn, placementsOf, viewKey } from './ad'

const shown = (id: number) => ({
  id,
  name: `ad ${id}`,
  image: `spotlight/banner/${id}.webp`,
  icon: null,
})

describe('placementsOf', () => {
  it('keys the chosen ads by slot and reads a missing list as empty', () => {
    const placements = placementsOf([
      { slot: 'home', ads: [shown(1), shown(2)] },
      { slot: 'sidebar', ads: null },
    ])
    expect(placements).toEqual({ home: [shown(1), shown(2)], sidebar: [] })
  })
})

describe('adsIn', () => {
  it('is empty for a slot that was not asked for or when nothing was loaded', () => {
    expect(adsIn({ home: [shown(1)] }, 'game')).toEqual([])
    expect(adsIn(undefined, 'home')).toEqual([])
    expect(adsIn({ home: [shown(1)] }, 'home')).toEqual([shown(1)])
  })
})

describe('viewKey', () => {
  it('tells the same ad in two slots apart', () => {
    expect(viewKey({ ad_id: 3, slot: 'game' })).not.toBe(viewKey({ ad_id: 3, slot: 'download' }))
  })
})
