import { FormField, Input, MultiCombobox } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import type { RouteDraft } from '../walkthrough-draft'

type ConditionFieldsProps = {
  route: RouteDraft
  others: readonly RouteDraft[]
  onChange: (fields: Partial<RouteDraft>) => void
}

export function ConditionFields({ route, others, onChange }: ConditionFieldsProps) {
  const t = useTranslations('walkthrough')
  return (
    <>
      <FormField name="requires">
        <MultiCombobox
          aria-label={t('requiredRoutes')}
          placeholder={t('chooseRequired')}
          value={route.requires}
          options={others.map(other => ({
            value: other.key,
            label: other.name.trim() === '' ? t('unnamed') : other.name,
          }))}
          onValueChange={requires => onChange({ requires: requires.map(String) })}
        />
      </FormField>
      <FormField name="condition">
        <Input
          aria-label={t('otherCondition')}
          placeholder={t('otherCondition')}
          value={route.condition}
          maxLength={lengthOf('WalkthroughRouteInput', 'condition').max}
          onValueChange={condition => onChange({ condition })}
        />
      </FormField>
    </>
  )
}
