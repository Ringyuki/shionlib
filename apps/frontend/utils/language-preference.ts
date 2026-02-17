import { supportedLocales, supportedLocalesEnum } from '@/config/i18n/supported'

const isBrowser = typeof window !== 'undefined'
export const LOCALE_COOKIE_KEY = 'shionlib_locale'

export const normalizeLocale = (maybeLocale?: string | null): string => {
  if (!maybeLocale) return supportedLocalesEnum.EN
  const lowered = maybeLocale.toLowerCase()
  if (supportedLocales.includes(lowered as any)) return lowered

  const base = lowered.split(/[\-_]/)[0]
  if (supportedLocales.includes(base as any)) return base
  return supportedLocalesEnum.EN
}

export const resolvePreferredLocale = async (): Promise<string> => {
  if (isBrowser) {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)${LOCALE_COOKIE_KEY}=([^;]+)/)
    const cookieLocale = cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined
    if (cookieLocale) return normalizeLocale(cookieLocale)

    const seg = window.location.pathname.split('/')[1]
    if (seg) return normalizeLocale(seg)

    return normalizeLocale(navigator.language)
  }

  try {
    const mod = await import('next/headers')
    const cookieStore = await (mod as any).cookies()
    const localeFromCookie = cookieStore?.get(`${LOCALE_COOKIE_KEY}`)?.value as string | undefined
    if (localeFromCookie) return normalizeLocale(localeFromCookie)

    const headersObj = await (mod as any).headers()
    const acceptLang = headersObj?.get('accept-language') as string | null
    if (acceptLang) return normalizeLocale(acceptLang.split(',')[0])
  } catch {}

  return supportedLocalesEnum.EN
}
