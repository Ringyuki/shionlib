import type { Locale } from '~/shared/i18n/locale'
import type { Messages } from './zh'

declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: Messages
  }
}
