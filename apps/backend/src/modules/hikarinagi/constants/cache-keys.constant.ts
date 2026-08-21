export const GALGAME_BUNDLE_KEY_PREFIX = 'hikarinagi:galgame:detail:'

export const galgameBundleKey = (hikarinagiId: number): string => {
  return `${GALGAME_BUNDLE_KEY_PREFIX}${hikarinagiId}`
}

export const GALGAME_IDS_KEY_PREFIX = 'hikarinagi:galgame:ids:'

export const GALGAME_IDS_CACHE_TTL_MS = 5 * 60 * 1000
