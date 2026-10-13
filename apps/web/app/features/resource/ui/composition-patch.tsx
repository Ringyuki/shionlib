import { Alert, Form, FormField, Stack, type FormHandle } from '@hina-ui/react'
import type { Ref } from 'react'
import { useMessages, useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { labelOf } from '~/shared/i18n/labels'
import { ChoiceChips } from '~/shared/ui/choice-chips'
import { languageOptions } from '../resource'
import {
  composedTranslations,
  inputPhase,
  type Composition,
  type DetailValues,
} from '../resource-composition'
import { detailsForm } from '../resource-composition.schema'
import { translated } from '../resource-info'
import type { CompositionTransfer } from '../use-composition-transfer'
import { useResourceIssue } from '../use-resource-issue'
import { CompositionInput } from './composition-input'
import { TranslationFields } from './translation-fields'

type CompositionPatchProps = {
  composition: Composition
  values: DetailValues
  form: Ref<FormHandle>
  patch: CompositionTransfer
  onValuesChange: (values: DetailValues) => void
  onRemove: () => void
  onSubmit: () => void
}

export function CompositionPatchStep({
  composition,
  values,
  form,
  patch,
  onValuesChange,
  onRemove,
  onSubmit,
}: CompositionPatchProps) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const kit = useFormKit()
  const issue = useResourceIssue()
  const change = (fields: Partial<DetailValues>) => onValuesChange({ ...values, ...fields })
  return (
    <Form ref={form} values={values} rules={detailsForm(kit, issue)} onSubmit={onSubmit}>
      <Stack gap="lg">
        <Stack gap="sm">
          <CompositionInput
            name="patch"
            label={t('composition.file')}
            drop={t('composition.patchDrop')}
            phase={inputPhase(composition.patch, patch.transfer)}
            transferred={patch.transfer}
            onChoose={patch.send}
            onRemove={() => {
              patch.stop()
              onRemove()
            }}
          />
          <Alert tone="info" open={composition.match !== null}>
            {t('composition.matched')}
          </Alert>
        </Stack>
        <FormField name="language" label={t('languages')} required>
          <ChoiceChips
            label={t('languages')}
            options={languageOptions}
            value={values.language}
            onValueChange={language => change({ language })}
            labelOf={value => labelOf(labels.game.language, value)}
          />
        </FormField>
        {translated(values.language) && (
          <TranslationFields
            values={values}
            required
            options={composedTranslations}
            onChange={change}
          />
        )}
      </Stack>
    </Form>
  )
}
