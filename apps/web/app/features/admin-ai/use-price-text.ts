import { useTranslations } from 'use-intl'
import { missing, useAiFormat } from './use-ai-format'

export function usePriceText() {
  const t = useTranslations('adminAi.price')
  const format = useAiFormat()
  return (input: number | null, output: number | null) => {
    if (input === null && output === null) {
      return missing
    }
    if ((input ?? 0) === 0 && (output ?? 0) === 0) {
      return t('free')
    }
    return t('perMillion', { input: format.price(input ?? 0), output: format.price(output ?? 0) })
  }
}
