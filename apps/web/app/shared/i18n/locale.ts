export const locales = ['zh', 'en', 'ja'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh'

export const localeCookie = 'shionlib_locale'

export const htmlLangs: Readonly<Record<Locale, string>> = { zh: 'zh-CN', en: 'en', ja: 'ja' }
