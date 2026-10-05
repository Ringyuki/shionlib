import * as v from 'valibot'
import { readCookie } from '~/shared/http/cookie'
import { defaultLocale, htmlLangs, localeCookie, locales, type Locale } from './locale'

const locale = v.picklist(locales)

const quality = v.fallback(v.pipe(v.string(), v.toNumber(), v.minValue(0), v.maxValue(1)), 0)

export function isLocale(value: unknown): value is Locale {
  return v.is(locale, value)
}

export function htmlLang(value: unknown): string {
  return htmlLangs[isLocale(value) ? value : defaultLocale]
}

export function negotiateLocale(cookieHeader: string, acceptLanguage: string): Locale {
  const fromCookie = readCookie(cookieHeader, localeCookie)
  if (isLocale(fromCookie)) {
    return fromCookie
  }
  const preferred = acceptLanguage
    .split(',')
    .map(entry => {
      const [tag = '', ...params] = entry.trim().split(';')
      const weight = params.find(param => param.trim().startsWith('q='))?.split('=')[1]
      return {
        language: tag.toLowerCase().split('-')[0],
        quality: weight === undefined ? 1 : v.parse(quality, weight.trim()),
      }
    })
    .filter(entry => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(entry => entry.language)
    .find(isLocale)
  return preferred ?? defaultLocale
}
