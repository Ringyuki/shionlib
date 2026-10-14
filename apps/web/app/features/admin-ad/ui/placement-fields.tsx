import { CheckboxGroup, DateTimePicker, FormLayout, Inline, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { fits, languages, materialOf, slots, type AdValues } from '../admin-ad'

type FieldProps = {
  values: AdValues
  onChange: (values: AdValues) => void
}

export function SlotChoices({ values, onChange }: FieldProps) {
  const t = useTranslations('adminAd')
  return (
    <CheckboxGroup
      orientation="horizontal"
      value={values.slots}
      options={slots.map(slot => {
        const name = t(`slot.${slot}`)
        const fitting = fits(values, slot)
        return {
          value: slot,
          disabled: !fitting,
          label: fitting
            ? name
            : t(materialOf(slot) === 'side' ? 'dialog.needsSide' : 'dialog.needsBanner', {
                slot: name,
              }),
        }
      })}
      onValueChange={chosen =>
        onChange({ ...values, slots: slots.filter(slot => chosen.includes(slot)) })
      }
    />
  )
}

export function LanguageChoices({ values, onChange }: FieldProps) {
  const t = useTranslations('adminAd.language')
  return (
    <CheckboxGroup
      orientation="horizontal"
      value={values.languages}
      options={languages.map(language => ({ value: language, label: t(language) }))}
      onValueChange={chosen =>
        onChange({
          ...values,
          languages: languages.filter(language => chosen.includes(language)),
        })
      }
    />
  )
}

export function ScheduleField({ values, onChange }: FieldProps) {
  const t = useTranslations('adminAd.dialog')
  return (
    <FormLayout legend={t('schedule')} description={t('scheduleHint')}>
      <Inline gap="sm" align="center" wrap={false}>
        <DateTimePicker
          aria-label={t('start')}
          placeholder={t('start')}
          clearable
          className="min-w-0 flex-1"
          value={values.startAt}
          max={values.endAt ?? undefined}
          onValueChange={startAt => onChange({ ...values, startAt })}
        />
        <Text as="span" size="sm" tone="muted">
          {t('to')}
        </Text>
        <DateTimePicker
          aria-label={t('end')}
          placeholder={t('end')}
          clearable
          className="min-w-0 flex-1"
          value={values.endAt}
          min={values.startAt ?? undefined}
          onValueChange={endAt => onChange({ ...values, endAt })}
        />
      </Inline>
    </FormLayout>
  )
}
