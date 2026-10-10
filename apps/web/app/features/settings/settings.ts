import type { Locale } from '~/shared/i18n/locale'

export const sections = ['personal', 'security', 'connections', 'download', 'site'] as const

export type Section = (typeof sections)[number]

export const firstSection: Section = 'personal'

export function sectionPath(locale: Locale, section: Section): string {
  return `/${locale}/user/settings/${section}`
}

export function sectionAt(pathname: string, locale: Locale): Section {
  return sections.find(section => pathname === sectionPath(locale, section)) ?? firstSection
}

export const nameCheckDelay = 400

export const pictureKinds = ['avatar', 'cover'] as const

export type PictureKind = (typeof pictureKinds)[number]

export const pictureShapes = {
  avatar: { aspect: 1, width: 512, height: 512, round: true },
  cover: { aspect: 3, width: 1500, height: 500, round: false },
} as const satisfies Record<PictureKind, object>
