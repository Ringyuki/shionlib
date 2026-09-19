export const MOYU_PATCH_RESOURCES_KEY_PREFIX = 'moyu:patch:resources:vndb:'

export const moyuPatchResourcesKey = (vndbId: string): string => {
  return `${MOYU_PATCH_RESOURCES_KEY_PREFIX}${vndbId}`
}

export const MOYU_PATCH_RESOURCES_CACHE_TTL_MS = 5 * 60 * 1000
