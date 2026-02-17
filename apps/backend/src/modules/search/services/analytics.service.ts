import { Injectable } from '@nestjs/common'
import { RedisService } from './redis.service'
import {
  SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX,
  SUGG_PREFIX_MIN_LENGTH,
  suggPrefixKey,
  trendKey,
  TREND_WINDOWS,
} from '../constants/analytics'
import { TrendWindow } from '../constants/analytics'

@Injectable()
export class SearchAnalyticsService {
  constructor(private readonly redisService: RedisService) {}

  async recordSearch(query: string) {
    const q = this.normalizeQuery(query)
    if (q.length < SUGG_PREFIX_MIN_LENGTH) return
    const client = await this.redisService.getClient()

    await Promise.all(TREND_WINDOWS.map(w => client.zincrby(trendKey(w), 1, q)))

    const pipeline = client.pipeline()
    for (let i = SUGG_PREFIX_MIN_LENGTH; i <= q.length; i++) {
      const prefix = q.slice(0, i)
      const key = suggPrefixKey(prefix)
      pipeline.zincrby(key, 1, q)
      pipeline.zremrangebyrank(key, 0, -1 * (SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX + 1))
    }
    await pipeline.exec()
  }

  async getTrends(limit = 10, windows: TrendWindow[] = TREND_WINDOWS) {
    const client = await this.redisService.getClient()

    const maps = await Promise.all(
      windows.map(async w => {
        const members = await client.zrevrange(trendKey(w), 0, limit - 1, 'WITHSCORES')
        const m = new Map<string, number>()
        for (let i = 0; i < members.length; i += 2) m.set(members[i], Number(members[i + 1]))
        return m
      }),
    )

    const agg = new Map<string, number>()
    maps.forEach(m => m.forEach((s, k) => agg.set(k, (agg.get(k) || 0) + s)))

    const sorted = Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    return sorted.map(([q, s]) => ({ query: q, score: s }))
  }

  async getSuggestions(prefix: string, limit = 10) {
    const client = await this.redisService.getClient()
    const key = suggPrefixKey(prefix.toLowerCase())
    const itemsWithScores = await client.zrevrange(key, 0, limit - 1, 'WITHSCORES')

    if (!itemsWithScores.length) return []
    const results: { query: string; score: number }[] = []
    for (let i = 0; i < itemsWithScores.length; i += 2) {
      const q = itemsWithScores[i]
      const s = Number(itemsWithScores[i + 1])
      results.push({ query: q, score: s })
    }
    return results
  }

  private normalizeQuery(query: string) {
    return (query ?? '').toLowerCase().trim()
  }
}
