export const SEARCH_ANALYTICS_QUEUE = 'search_analytics'

export const TREND_WINDOWS = ['1h', '6h', '1d']
export type TrendWindow = (typeof TREND_WINDOWS)[number]

export const trendKey = (window: TrendWindow) => `trends:${window}`

export const SUGG_FREQ_KEY = 'sugg:freq'
export const suggPrefixKey = (prefix: string) => `sugg:prefix:${prefix}`
export const SUGG_PREFIX_KEY_PATTERN = 'sugg:prefix:*'

export const SUGG_PREFIX_MIN_LENGTH = 1
export const SUGG_PREFIX_MAX_CANDIDATES_PER_PREFIX = 200 // max candidates per prefix

export const ANALYTICS_DECAY_CRON = '0 0 * * * *' // every hour
export const ANALYTICS_TRIM_CRON = '0 10 * * * *' // every hour at 10th second

export const SUGG_DECAY_CRON = '0 5 * * * *' // every hour at 5th second
export const SUGG_DECAY_FACTOR = 0.9
export const SUGG_MIN_SCORE = 0.01
