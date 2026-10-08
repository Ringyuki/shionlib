export const locales = ['zh', 'en', 'ja'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh'

export const localeCookie = 'shionlib_locale'

export const localeNames: Readonly<Record<Locale, string>> = {
  zh: '简体中文',
  en: 'English',
  ja: '日本語',
}

export const htmlLangs: Readonly<Record<Locale, string>> = { zh: 'zh-CN', en: 'en', ja: 'ja' }

export function localeCookieValue(locale: Locale): string {
  return `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
}
