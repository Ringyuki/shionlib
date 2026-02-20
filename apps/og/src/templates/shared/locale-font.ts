import type { SupportedLocale } from '@/config'

const FONT_FAMILY_BY_LOCALE: Record<SupportedLocale, string> = {
  en: 'NotoSans, NotoSansJP, NotoSansSC',
  zh: 'NotoSansJP, NotoSansSC, NotoSans',
  ja: 'NotoSansJP, NotoSansSC, NotoSans',
}

export function getLocaleFontFamily(locale: SupportedLocale): string {
  return FONT_FAMILY_BY_LOCALE[locale]
}
