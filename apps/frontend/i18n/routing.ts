import { defineRouting } from 'next-intl/routing'
import { supportedLocales } from '@/config/i18n/supported'
import { supportedLocalesEnum } from '@/config/i18n/supported'
import { LOCALE_COOKIE_KEY } from '@/utils/language-preference'

export const routing = defineRouting({
  locales: supportedLocales,

  defaultLocale: supportedLocalesEnum.EN,
  localeCookie: {
    name: LOCALE_COOKIE_KEY,
  },
})
