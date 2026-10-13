import { FormField, Inline, Input } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { labelOf } from '~/shared/i18n/labels'
import { ChoiceChips, SingleChoiceChips } from '~/shared/ui/choice-chips'
import { editionOptions, extraOptions, formOptions, type InfoValues } from '../resource-info'

type InfoFieldsProps = {
  values: InfoValues
  complete: boolean
  onChange: (patch: Partial<InfoValues>) => void
}

export function InfoFields({ values, complete, onChange }: InfoFieldsProps) {
  const t = useTranslations('resource')
  const labels = useMessages().resource
  return (
    <>
      <FormField name="edition" label={t('edition')}>
        <Inline gap="sm" align="center" className="gap-y-2">
          <SingleChoiceChips
            label={t('edition')}
            options={editionOptions}
            value={values.edition}
            onValueChange={edition => onChange({ edition })}
            labelOf={value => labelOf(labels.editionName, value)}
          />
          <Input
            value={values.editionName}
            onValueChange={editionName => onChange({ editionName })}
            placeholder={t('editionNameExample')}
            aria-label={t('editionNameLabel')}
            maxLength={lengthOf('EditDownloadSourceBodyInput', 'edition_name').max}
            className="w-64 max-sm:w-full"
          />
        </Inline>
      </FormField>
      <FormField name="form" label={t('form')} required={complete}>
        <SingleChoiceChips
          label={t('form')}
          options={formOptions}
          value={values.form}
          onValueChange={form => onChange({ form })}
          labelOf={value => labelOf(labels.formName, value)}
        />
      </FormField>
      <FormField name="extras" label={t('extras')}>
        <ChoiceChips
          label={t('extras')}
          options={extraOptions}
          value={values.extras}
          onValueChange={extras => onChange({ extras })}
          labelOf={value => labelOf(labels.extraName, value)}
        />
      </FormField>
    </>
  )
}
