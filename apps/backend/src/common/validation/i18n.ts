import { i18nValidationMessage } from 'nestjs-i18n'
import { I18nPath } from '../../generated/i18n.generated'

type ValidationKey = Extract<I18nPath, `validation.${string}`>

export const ivm = (key: ValidationKey, args?: Record<string, any>) =>
  i18nValidationMessage(key, args)

export const ivmEnum = <TEnum extends object>(
  key: ValidationKey,
  e: TEnum,
  args?: Record<string, any>,
) =>
  i18nValidationMessage(key, {
    allowed: Object.values(e)
      .filter(v => typeof v === 'string')
      .join(', '),
    ...args,
  })
