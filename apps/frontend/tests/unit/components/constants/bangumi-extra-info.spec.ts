import { describe, expect, it } from 'vitest'
import { BangumiExtraInfoKeyMap } from '../../../../components/game/description/constants/BangumiExtraInfoKeyMap'

describe('components/game/description/constants/BangumiExtraInfoKeyMap (unit)', () => {
  it('contains stable canonical mappings and aliases', () => {
    expect(BangumiExtraInfoKeyMap['C G']).toBe('cg_artists')
    expect(BangumiExtraInfoKeyMap.CG).toBe('cg_artists')
    expect(BangumiExtraInfoKeyMap.企画).toBe('project')
    expect(BangumiExtraInfoKeyMap.企划).toBe('project')
    expect(BangumiExtraInfoKeyMap.twitter).toBe('twitter')
    expect(Object.keys(BangumiExtraInfoKeyMap).length).toBeGreaterThan(10)
  })
})
