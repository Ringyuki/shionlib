import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { type SupportedLocales } from '@/config/i18n/supported'

const messageLoaders: Record<
  SupportedLocales,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  en: () => import('../messages/en'),
  zh: () => import('../messages/zh'),
  ja: () => import('../messages/ja'),
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await messageLoaders[locale as SupportedLocales]()).default,
  }
})
