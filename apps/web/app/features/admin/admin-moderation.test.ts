import { describe, expect, it } from 'vitest'
import { scoresShown, topScores } from './admin-moderation'

describe('topScores', () => {
  it('keeps the highest few that are worth showing', () => {
    expect(
      topScores({ SPAM: 0.71, MEANINGLESS: 0.22, HARASSMENT: 0.03, VIOLENCE: 0.02, HATE: 0.001 }),
    ).toEqual([
      { category: 'SPAM', value: 0.71 },
      { category: 'MEANINGLESS', value: 0.22 },
      { category: 'HARASSMENT', value: 0.03 },
    ])
    expect(topScores({ HATE: 0.001 })).toEqual([])
    expect(topScores({})).toEqual([])
    expect(scoresShown).toBe(3)
  })
})
