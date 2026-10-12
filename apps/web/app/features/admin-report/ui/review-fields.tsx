import { Alert, FormField, RadioGroup, SegmentedControl, Switch, Textarea } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { falseOutlook, freezeDays, levels, penaltyOf, verdicts, type Opened } from '../admin-report'
import type { ReviewValues } from '../admin-report.schema'

type ReviewFieldsProps = {
  opened: Opened
  values: ReviewValues
  onValuesChange: (values: ReviewValues) => void
}

export function ReviewFields({ opened, values, onValuesChange }: ReviewFieldsProps) {
  const t = useTranslations('adminReport.review')
  const levelNames = useTranslations('adminReport.level')
  const { detail, policy } = opened
  const valid = values.verdict === 'VALID'
  const penalty = penaltyOf(policy, values.level)
  const outlook = falseOutlook(policy, detail.reporter_record.next_invalid)
  return (
    <>
      <FormField name="verdict">
        <RadioGroup
          aria-label={t('decision')}
          orientation="horizontal"
          block
          value={values.verdict}
          options={verdicts.map(verdict => ({
            value: verdict,
            label: t(`verdict.${verdict}`),
            description: t(`verdictHint.${verdict}`),
          }))}
          onValueChange={value =>
            onValuesChange({
              ...values,
              verdict: verdicts.find(verdict => verdict === value) ?? null,
            })
          }
        />
      </FormField>
      {valid && (
        <FormField
          name="level"
          label={t('level')}
          description={t('consequence', {
            level: levelNames(values.level),
            ban: penalty?.ban_days ?? 0,
            violation: String(penalty?.violation === true),
            freeze: freezeDays(policy),
          })}
        >
          <SegmentedControl
            value={values.level}
            options={levels.map(level => ({ value: level, label: levelNames(level) }))}
            onValueChange={value =>
              onValuesChange({
                ...values,
                level: levels.find(level => level === value) ?? values.level,
              })
            }
          />
        </FormField>
      )}
      {valid && (
        <FormField name="remove">
          <Switch
            checked={values.remove}
            onCheckedChange={remove => onValuesChange({ ...values, remove })}
            description={t('removeHint')}
          >
            {t('remove')}
          </Switch>
        </FormField>
      )}
      <Alert tone="info" open={values.verdict === 'INVALID'}>
        {t('outlook', {
          name: detail.reporter.name,
          count: outlook.count,
          ban: outlook.now?.ban_days ?? 0,
          later: outlook.later
            .map(step => t('outlookStep', { count: step.count, days: step.ban_days }))
            .join(t('separator')),
          more: String(outlook.later.length > 0),
        })}
      </Alert>
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
          {t('notify', { verdict: values.verdict ?? 'none' })}
        </Switch>
      </FormField>
    </>
  )
}
