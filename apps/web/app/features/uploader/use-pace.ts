import { useFormatter, useTranslations } from 'use-intl'
import type { Upload } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import { paceOf } from './uploader'

export function usePace(uploads: readonly Upload[]): string | undefined {
  const t = useTranslations('uploader.transfers')
  const format = useFormatter()
  const bytes = useBytes()
  const pace = paceOf(uploads)
  if (pace === undefined) {
    return undefined
  }
  const { seconds } = pace
  const [value, unit] =
    seconds < 90
      ? [seconds, 'second']
      : seconds < 5400
        ? [seconds / 60, 'minute']
        : [seconds / 3600, 'hour']
  const time = format.number(value, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  })
  return t('speed', { speed: bytes(pace.speed), time })
}
