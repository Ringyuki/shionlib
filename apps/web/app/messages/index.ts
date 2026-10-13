import type { Locale } from '~/shared/i18n/locale'
import type { Messages } from './zh'

const loaders: Record<Locale, () => Promise<{ messages: Messages }>> = {
  zh: () => import('./zh'),
  en: () => import('./en'),
  ja: () => import('./ja'),
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).messages
}

export type { Messages }
