import {
  Alert,
  CheckboxGroup,
  Dialog,
  Form,
  FormField,
  Inline,
  Select,
  Textarea,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useMessages, useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
import {
  languageOptions,
  needsSimulator,
  platformOptions,
  simulatorOptions,
  type Resource,
} from '../resource'
import { editForm, editValuesFrom, type EditValues } from '../resource.schema'
import { useEditResource } from '../use-edit-resource'

type EditDialogProps = {
  resource: Resource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDialog({ resource, open, onOpenChange }: EditDialogProps) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const issue = useTranslations('resource.issue')
  const kit = useFormKit()
  const [values, setValues] = useState<EditValues>(() => editValuesFrom(resource))
  const edit = useEditResource(() => {
    onOpenChange(false)
    toast.success(t('saved'))
  })
  const { form, message } = useSubmissionFeedback(edit.failure)
  const changeOpen = (next: boolean) => {
    if (next) {
      setValues(editValuesFrom(resource))
    }
    onOpenChange(next)
  }
  return (
    <Dialog
      title={t('editTitle')}
      open={open}
      onOpenChange={changeOpen}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={editForm(kit, issue)}
          onSubmit={() => edit.submit({ resourceId: resource.id, ...values })}
        >
          {({ submitting }) => (
            <>
              <FormField name="platform" label={t('platforms')} required>
                <CheckboxGroup
                  orientation="horizontal"
                  value={values.platform}
                  onValueChange={chosen =>
                    setValues({
                      ...values,
                      platform: platformOptions.filter(option => chosen.includes(option)),
                    })
                  }
                  options={platformOptions.map(value => ({
                    value,
                    label: labelOf(labels.game.platform, value),
                  }))}
                />
              </FormField>
              <FormField name="language" label={t('languages')} required>
                <CheckboxGroup
                  orientation="horizontal"
                  value={values.language}
                  onValueChange={chosen =>
                    setValues({
                      ...values,
                      language: languageOptions.filter(option => chosen.includes(option)),
                    })
                  }
                  options={languageOptions.map(value => ({
                    value,
                    label: labelOf(labels.game.language, value),
                  }))}
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
                      setValues({
                        ...values,
                        simulator: simulatorOptions.find(option => option === chosen) ?? '',
                      })
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
                <Textarea
                  value={values.note}
                  onValueChange={note => setValues({ ...values, note })}
                  autosize={{ minRows: 3, maxRows: 8 }}
                />
              </FormField>
              <Alert tone="danger" open={message !== undefined}>
                {message}
              </Alert>
              <Inline gap="sm" justify="end">
                <Button variant="ghost" tone="neutral" onClick={close}>
                  {t('cancel')}
                </Button>
                <Button type="submit" loading={submitting}>
                  {t('save')}
                </Button>
              </Inline>
            </>
          )}
        </Form>
      )}
    />
  )
}
