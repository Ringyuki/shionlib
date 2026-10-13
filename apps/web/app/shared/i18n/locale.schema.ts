import * as v from 'valibot'
import { readCookie } from '~/shared/http/cookie'
import { defaultLocale, htmlLangs, localeCookie, locales, type Locale } from './locale'

const locale = v.picklist(locales)

export function isLocale(value: unknown): value is Locale {
  return v.is(locale, value)
}

export function htmlLang(value: unknown): string {
  return htmlLangs[isLocale(value) ? value : defaultLocale]
}

export function chosenLocale(cookieHeader: string): Locale {
  const fromCookie = readCookie(cookieHeader, localeCookie)
  return isLocale(fromCookie) ? fromCookie : defaultLocale
}

export function localizedLocation(cookieHeader: string, url: URL): string {
  return switchLocale(url.pathname, chosenLocale(cookieHeader)) + url.search
}

export function switchLocale(pathname: string, locale: Locale): string {
  const [, first = '', ...rest] = pathname.split('/')
  const tail = isLocale(first) ? rest : [first, ...rest]
  return ['', locale, ...tail].join('/').replace(/\/$/, '') || `/${locale}`
}
