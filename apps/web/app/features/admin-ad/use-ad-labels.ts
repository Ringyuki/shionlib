import { useFormatter, useTranslations } from 'use-intl'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { languages, slots, type AdminAd, type Language, type Slot } from './admin-ad'

export function useAdLabels() {
  const t = useTranslations('adminAd')
  const format = useFormatter()
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: 'medium', timeZone: siteTimeZone })
  return {
    slots: (chosen: readonly Slot[] | null) =>
      chosen === null || chosen.length === 0
        ? t('noSlots')
        : slots
            .filter(slot => chosen.includes(slot))
            .map(slot => t(`slot.${slot}`))
            .join('、'),
    languages: (chosen: readonly Language[] | null) =>
      languages
        .filter(language => chosen?.includes(language) === true)
        .map(language => t(`language.${language}`))
        .join('、'),
    schedule: ({ start_at: start, end_at: end }: Pick<AdminAd, 'start_at' | 'end_at'>) =>
      start === null
        ? end === null
          ? t('schedule.always')
          : t('schedule.until', { end: day(end) })
        : end === null
          ? t('schedule.from', { start: day(start) })
          : t('schedule.between', { start: day(start), end: day(end) }),
  }
}
