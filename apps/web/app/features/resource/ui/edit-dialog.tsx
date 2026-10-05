import { Alert, Dialog, Form, Inline, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
import type { Resource } from '../resource'
import { editForm, editValuesFrom, type EditValues } from '../resource.schema'
import { useEditResource } from '../use-edit-resource'
import { ResourceFields } from './resource-fields'

type EditDialogProps = {
  resource: Resource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDialog({ resource, open, onOpenChange }: EditDialogProps) {
  const t = useTranslations('resource')
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
              <ResourceFields values={values} onValuesChange={setValues} />
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
