export type HikarinagiEntityType = 'galgame' | 'character' | 'producer'

export const hikarinagiMirror = {
  siteUrl: (process.env.NEXT_PUBLIC_HIKARINAGI_SITE_URL || 'https://www.hikarinagi.org').replace(
    /\/$/,
    '',
  ),
}

export function hikarinagiEditUrl(type: HikarinagiEntityType, hikarinagiId: number): string {
  return `${hikarinagiMirror.siteUrl}/create/edit/${type}/${hikarinagiId}`
}
