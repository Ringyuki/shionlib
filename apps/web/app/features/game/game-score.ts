import type { Schema } from '~/shared/api/types'
import { vndbUrl } from '~/shared/catalog/vndb'
import type { GameHeader } from './game'

export type ScoreSource = 'bangumi' | 'vndb'

export type Score = { value: number; votes: number }

export type Scores = Partial<Record<ScoreSource, Score>>

export type ScoreSite = { source: ScoreSource; url: string }

export function scoreSites(game: Pick<GameHeader, 'b_id' | 'v_id'>): ScoreSite[] {
  const sites: ScoreSite[] = []
  if (game.b_id !== null && game.b_id !== '') {
    sites.push({ source: 'bangumi', url: `https://bgm.tv/subject/${game.b_id}` })
  }
  if (game.v_id !== null && game.v_id !== '') {
    sites.push({ source: 'vndb', url: vndbUrl(game.v_id) })
  }
  return sites
}

export function bangumiScore(data: Schema<'BangumiScoreDTO'>): Score | undefined {
  const { score, total } = data.rating
  return score > 0 && total > 0 ? { value: score, votes: total } : undefined
}

export function vndbScore(data: Schema<'VndbScoreDTO'>): Score | undefined {
  return data.rating === null || data.votecount === 0
    ? undefined
    : { value: data.rating / 10, votes: data.votecount }
}
