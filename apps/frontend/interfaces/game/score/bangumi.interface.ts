export interface BangumiScore {
  id: number
  rating: {
    rank: number
    total: number
    count: Record<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10', number>
    score: number
  }
}
