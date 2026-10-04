export const locales = ['zh', 'en', 'ja'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh'

export const localeCookie = 'shionlib_locale'

const htmlLangs: Record<Locale, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' }

export function isLocale(value: unknown): value is Locale {
  return locales.some(locale => locale === value)
}

export function htmlLang(value: unknown): string {
  return isLocale(value) ? htmlLangs[value] : htmlLangs[defaultLocale]
}

export function negotiateLocale(cookieHeader: string, acceptLanguage: string): Locale {
  const fromCookie = cookieHeader
    .split(';')
    .map(part => part.trim().split('='))
    .find(([name]) => name === localeCookie)?.[1]
  if (isLocale(fromCookie)) {
    return fromCookie
  }
  const preferred = acceptLanguage
    .split(',')
    .map(entry => {
      const [tag = '', ...params] = entry.trim().split(';')
      const quality = Number(
        params.find(param => param.trim().startsWith('q='))?.split('=')[1] ?? 1,
      )
      return { language: tag.toLowerCase().split('-')[0], quality }
    })
    .filter(entry => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(entry => entry.language)
    .find(isLocale)
  return preferred ?? defaultLocale
}
