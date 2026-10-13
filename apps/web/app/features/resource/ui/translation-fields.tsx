import { FormField, Grid, Input } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { TranslatorField } from '~/features/translator'
import { lengthOf } from '~/shared/form/form-kit'
import { labelOf } from '~/shared/i18n/labels'
import { SingleChoiceChips } from '~/shared/ui/choice-chips'
import {
  credited,
  patched,
  translationOptions,
  type InfoValues,
  type Translation,
} from '../resource-info'

type TranslationFieldsProps = {
  values: InfoValues
  required: boolean
  options?: readonly Translation[]
  onChange: (patch: Partial<InfoValues>) => void
}

export function TranslationFields({
  values,
  required,
  options = translationOptions,
  onChange,
}: TranslationFieldsProps) {
  const t = useTranslations('resource')
  const labels = useMessages().resource
  return (
    <>
      <FormField name="translation" label={t('translation')} required={required}>
        <SingleChoiceChips
          label={t('translation')}
          options={options}
          value={values.translation}
          onValueChange={translation => onChange({ translation })}
          labelOf={value => labelOf(labels.translationName, value)}
        />
      </FormField>
      {credited(values.translation) && (
        <FormField name="translators" label={t('translators')} required>
          <TranslatorField
            value={values.translators}
            onValueChange={translators => onChange({ translators })}
          />
        </FormField>
      )}
      {patched(values.translation) && (
        <Grid gap="md" className="sm:grid-cols-[10.5rem_minmax(0,1fr)]">
          <FormField name="patchVersion" label={t('patchVersion')}>
            <Input
              value={values.patchVersion}
              onValueChange={patchVersion => onChange({ patchVersion })}
              placeholder={t('patchVersionExample')}
              maxLength={lengthOf('EditDownloadSourceBodyInput', 'patch_version').max}
            />
          </FormField>
          <FormField name="releaseUrl" label={t('releaseUrl')}>
            <Input
              type="url"
              inputMode="url"
              value={values.releaseUrl}
              onValueChange={releaseUrl => onChange({ releaseUrl })}
              placeholder="https://"
              maxLength={lengthOf('EditDownloadSourceBodyInput', 'release_url').max}
            />
          </FormField>
        </Grid>
      )}
    </>
  )
}
