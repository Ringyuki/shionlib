import { Alert, Dialog, Form, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useDialogFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
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
  const [values, setValues] = useOpenState<EditValues>(open, () => editValuesFrom(resource))
  const edit = useEditResource(() => {
    onOpenChange(false)
    toast.success(t('saved'))
  })
  const { form, message } = useDialogFeedback(open, edit.failure)
  return (
    <Dialog
      title={t('editTitle')}
      open={open}
      onOpenChange={onOpenChange}
      locked={edit.pending}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={editForm(kit, issue)}
          onSubmit={() => edit.submit({ resourceId: resource.id, ...values })}
        >
          <ResourceFields values={values} onValuesChange={setValues} />
          <Alert tone="danger" open={message !== undefined}>
            {message}
          </Alert>
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={edit.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={edit.pending} onClick={() => void form.current?.submit()}>
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
