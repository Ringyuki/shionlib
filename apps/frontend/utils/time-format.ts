import { format, formatDistanceToNow } from 'date-fns'
import { ja, enUS, zhCN, Locale } from 'date-fns/locale'
import { SupportedLocales } from '@/config/i18n/supported'

const localeMap: Record<SupportedLocales, Locale> = {
  en: enUS,
  zh: zhCN,
  ja: ja,
}
export enum TimeFormatEnum {
  YYYY_MM_DD_HH_MM_SS = 'yyyy-MM-dd HH:mm:ss',
  YYYY_MM_DD_HH_MM_SS_A = 'yyyy-MM-dd hh:mm:ss a',

  YYYY_MM_DD = 'yyyy-MM-dd',
  MM_DD_YYYY = 'MM/dd/yyyy',
  DD_MM_YYYY = 'dd/MM/yyyy',

  YYYY_DOT_MM_DOT_DD = 'yyyy.MM.dd',

  YYYY_MM = 'yyyy-MM',
  MM_DD = 'MM-dd',

  ISO_DATE = "yyyy-MM-dd'T'HH:mm:ssXXX",

  HH_MM_SS = 'HH:mm:ss',
  HH_MM_SS_A = 'hh:mm:ss a',
  HH_MM = 'HH:mm',
  HH_MM_A = 'hh:mm a',

  EEEE_MMM_DD_YYYY = 'EEEE, MMM dd, yyyy', // Monday, Jan 01, 2025
  EEE_MMM_DD_YYYY = 'EEE, MMM dd, yyyy', // Mon, Jan 01, 2025
}

export const timeFormat = (
  date: Date | number | string,
  locale: string,
  formatPattern: TimeFormatEnum = TimeFormatEnum.YYYY_MM_DD_HH_MM_SS,
) => {
  return format(date, formatPattern, { locale: localeMap[locale as SupportedLocales] })
}

export const timeFromNow = (date: Date | number | string, locale: string) => {
  if (!date) return ''
  return formatDistanceToNow(date, {
    locale: localeMap[locale as SupportedLocales],
    addSuffix: true,
  })
}
