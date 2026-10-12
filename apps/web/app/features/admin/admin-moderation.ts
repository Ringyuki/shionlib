import type { Schema } from '~/shared/api/types'

export const categories = [
  'HARASSMENT',
  'HARASSMENT_THREATENING',
  'SEXUAL',
  'SEXUAL_MINORS',
  'HATE',
  'HATE_THREATENING',
  'ILLICIT',
  'ILLICIT_VIOLENT',
  'SELF_HARM',
  'SELF_HARM_INTENT',
  'SELF_HARM_INSTRUCTIONS',
  'VIOLENCE',
  'VIOLENCE_GRAPHIC',
  'SPAM',
  'MEANINGLESS',
] as const

export type Category = (typeof categories)[number]

export type Verdict = Pick<
  Schema<'AdminCommentModerationDTO'>,
  'decision' | 'top_category' | 'max_score'
>

export type ModerationRun = Pick<
  Schema<'AdminCommentEventDTO'>,
  | 'id'
  | 'model'
  | 'decision'
  | 'top_category'
  | 'max_score'
  | 'created_at'
  | 'reason'
  | 'evidence'
  | 'scores_json'
>

export type Score = {
  category: string
  value: number
}

export const scoresShown = 3

const noticeable = 0.01

export function topScores(scores: Readonly<Record<string, number>>): Score[] {
  return Object.entries(scores)
    .map(([category, value]) => ({ category, value }))
    .filter(score => score.value >= noticeable)
    .toSorted((a, b) => b.value - a.value)
    .slice(0, scoresShown)
}
