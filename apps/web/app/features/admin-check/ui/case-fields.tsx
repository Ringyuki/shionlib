import { FormField, RadioGroup, Switch, Textarea } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { decisions, type ReviewPolicy } from '../admin-check'
import type { CaseReviewValues } from '../admin-check.schema'

type CaseFieldsProps = {
  policy: ReviewPolicy
  values: CaseReviewValues
  onValuesChange: (values: CaseReviewValues) => void
}

export function CaseFields({ policy, values, onValuesChange }: CaseFieldsProps) {
  const t = useTranslations('adminCheck.pane')
  return (
    <>
      <FormField name="decision">
        <RadioGroup
          aria-label={t('review')}
          block
          value={values.decision}
          options={decisions.map(decision => ({
            value: decision,
            label: t(`decision.${decision}`),
            description: t(`decisionHint.${decision}`, {
              threshold: policy.auto_ban_threshold,
              days: policy.auto_ban_days,
            }),
          }))}
          onValueChange={value =>
            onValuesChange({
              ...values,
              decision: decisions.find(decision => decision === value) ?? null,
            })
          }
        />
      </FormField>
      <FormField name="note" label={t('note')}>
        <Textarea
          value={values.note}
          onValueChange={note => onValuesChange({ ...values, note })}
          placeholder={t('notePlaceholder')}
          autosize={{ minRows: 2, maxRows: 6 }}
        />
      </FormField>
      <FormField name="notify">
        <Switch
          checked={values.notify}
          onCheckedChange={notify => onValuesChange({ ...values, notify })}
        >
          {t('notify')}
        </Switch>
      </FormField>
    </>
  )
}
