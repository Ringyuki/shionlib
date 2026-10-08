import { FormField, Select } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { PlatformIcon } from '~/features/game'
import { lengthOf } from '~/shared/form/form-kit'
import { labelOf } from '~/shared/i18n/labels'
import { BBCodeEditor } from '~/shared/ui/bbcode-editor'
import { ChoiceChips } from '~/shared/ui/choice-chips'
import { languageOptions, needsSimulator, platformOptions, simulatorOptions } from '../resource'
import type { EditValues } from '../resource.schema'

type ResourceFieldsProps = {
  values: EditValues
  onValuesChange: (values: EditValues) => void
}

export function ResourceFields({ values, onValuesChange }: ResourceFieldsProps) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const change = (patch: Partial<EditValues>) => onValuesChange({ ...values, ...patch })
  return (
    <>
      <FormField name="platform" label={t('platforms')} required>
        <ChoiceChips
          label={t('platforms')}
          options={platformOptions}
          value={values.platform}
          onValueChange={platform => change({ platform })}
          labelOf={value => labelOf(labels.game.platform, value)}
          iconOf={value => <PlatformIcon platform={value} />}
        />
      </FormField>
      <FormField name="language" label={t('languages')} required>
        <ChoiceChips
          label={t('languages')}
          options={languageOptions}
          value={values.language}
          onValueChange={language => change({ language })}
          labelOf={value => labelOf(labels.game.language, value)}
        />
      </FormField>
      {needsSimulator(values.platform) && (
        <FormField
          name="simulator"
          label={t('simulator')}
          description={t('simulatorHint')}
          required
        >
          <Select
            value={values.simulator === '' ? null : values.simulator}
            onValueChange={chosen =>
              change({ simulator: simulatorOptions.find(option => option === chosen) ?? '' })
            }
            options={simulatorOptions.map(value => ({
              value,
              label: labelOf(labels.resource.simulatorName, value),
            }))}
          />
        </FormField>
      )}
      <FormField
        name="note"
        label={t('note')}
        description={t('noteHint', lengthOf('EditDownloadSourceBodyInput', 'note'))}
      >
        <BBCodeEditor value={values.note} onValueChange={note => change({ note })} />
      </FormField>
    </>
  )
}
