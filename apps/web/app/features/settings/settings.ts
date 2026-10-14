import type { Locale } from '~/shared/i18n/locale'

export const sections = [
  'personal',
  'security',
  'connections',
  'download',
  'site',
  'api-keys',
] as const

export type Section = (typeof sections)[number]

export const firstSection: Section = 'personal'

export function sectionPath(locale: Locale, section: Section): string {
  return `/${locale}/user/settings/${section}`
}

export function sectionAt(pathname: string, locale: Locale): Section {
  return sections.find(section => pathname === sectionPath(locale, section)) ?? firstSection
}

export const nameCheckDelay = 400
