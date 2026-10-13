import { useFormatter, useTranslations } from 'use-intl'
import { fittingUnit, unitsOf, type Kind, type Value } from '../admin-setting'

export function useShownValue() {
  const t = useTranslations('adminSetting')
  const format = useFormatter()
  return (kind: Kind, value: Value): string => {
    if (typeof value === 'boolean') {
      return t(value ? 'on' : 'off')
    }
    if (typeof value === 'string') {
      return value === '' ? t('blank') : value
    }
    const units = unitsOf(kind)
    if (units === undefined) {
      return format.number(value, { maximumFractionDigits: 4 })
    }
    const unit = fittingUnit(units, value)
    return t('amount', {
      amount: format.number(value / unit.size, { maximumFractionDigits: 4 }),
      unit: t(`unit.${unit.unit}`),
    })
  }
}
