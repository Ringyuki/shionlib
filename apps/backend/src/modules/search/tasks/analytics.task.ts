import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { RedisService } from '../../search/services/redis.service'
import {
  ANALYTICS_DECAY_CRON,
  ANALYTICS_TRIM_CRON,
  SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX,
  SUGG_PREFIX_KEY_PATTERN,
  TREND_WINDOWS,
  trendKey,
  SUGG_DECAY_CRON,
  SUGG_DECAY_FACTOR,
  SUGG_MIN_SCORE,
} from '../constants/analytics'

@Injectable()
export class SearchAnalyticsTask {
  constructor(private readonly redis: RedisService) {}

  /**
   * decay trends
   * @description trends will be decayed by 10% every hour. If the score is less than 0.01, the trend will be removed.
   */
  @Cron(ANALYTICS_DECAY_CRON)
  async decayTrends() {
    const client = await this.redis.getClient()
    for (const w of TREND_WINDOWS) {
      const key = trendKey(w)
      const members = await client.zrange(key, 0, -1, 'WITHSCORES')
      const pipeline = client.pipeline()
      for (let i = 0; i < members.length; i += 2) {
        const member = members[i]
        const score = Number(members[i + 1])
        const newScore = Math.max(0, score * 0.9)
        if (newScore <= 0.01) pipeline.zrem(key, member)
        else pipeline.zadd(key, newScore, member)
      }
      await pipeline.exec()
    }
  }

  /**
   * trim suggest prefixes
   * @description suggest prefixes will be trimmed to keep the number of candidates per prefix within the limit.
   */
  @Cron(ANALYTICS_TRIM_CRON)
  async trimSuggestPrefixes() {
    const client = await this.redis.getClient()
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', SUGG_PREFIX_KEY_PATTERN, 'COUNT', 200)
      cursor = next
      const pipeline = client.pipeline()
      for (const key of keys) {
        pipeline.zremrangebyrank(key, 0, -1 * (SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX + 1))
      }
      await pipeline.exec()
    } while (cursor !== '0')
  }

  /**
   * decay suggestions
   * @description suggestions scores will be decayed by SUGG_DECAY_FACTOR every hour, and low scores removed.
   */
  @Cron(SUGG_DECAY_CRON)
  async decaySuggestions() {
    const client = await this.redis.getClient()
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', SUGG_PREFIX_KEY_PATTERN, 'COUNT', 200)
      cursor = next
      const pipeline = client.pipeline()
      for (const key of keys) {
        // scale all scores by factor using ZUNIONSTORE trick
        pipeline.zunionstore(key, 1, key, 'WEIGHTS', SUGG_DECAY_FACTOR)
        // remove too small scores
        pipeline.zremrangebyscore(key, '-inf', SUGG_MIN_SCORE)
      }
      await pipeline.exec()
    } while (cursor !== '0')
  }
}
