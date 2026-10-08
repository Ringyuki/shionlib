import { describe, expect, it } from 'vitest'
import { bangumiScore, vndbScore } from './game-score'

describe('scores', () => {
  it('are nothing when the site has no score for the game', () => {
    expect(bangumiScore(null)).toBeUndefined()
    expect(vndbScore(null)).toBeUndefined()
    expect(vndbScore({ id: 'v17', rating: null, average: null, votecount: 0 })).toBeUndefined()
    expect(
      bangumiScore({ id: 42, rating: { score: 0, total: 0, rank: 0, count: {} } }),
    ).toBeUndefined()
  })

  it('carry the value on a scale of ten and the number of votes', () => {
    expect(
      bangumiScore({ id: 42, rating: { score: 7.9, total: 300, rank: 12, count: {} } }),
    ).toEqual({ value: 7.9, votes: 300 })
    expect(vndbScore({ id: 'v17', rating: 85.2, average: 8.4, votecount: 1200 })).toEqual({
      value: 8.52,
      votes: 1200,
    })
  })
})
