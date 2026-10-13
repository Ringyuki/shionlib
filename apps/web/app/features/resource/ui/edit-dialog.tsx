import { Dialog, Form, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { Resource } from '../resource'
import { editForm, editValuesFrom, type EditValues } from '../resource.schema'
import { useEditResource } from '../use-edit-resource'
import { useResourceIssue } from '../use-resource-issue'
import { ResourceFields } from './resource-fields'

type EditDialogProps = {
  resource: Resource
  game: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDialog({ resource, game, open, onOpenChange }: EditDialogProps) {
  const t = useTranslations('resource')
  const issue = useResourceIssue()
  const kit = useFormKit()
  const [values, setValues] = useOpenState<EditValues>(open, () => editValuesFrom(resource))
  const edit = useEditResource()
  const [first] = resource.files ?? []
  const named =
    first === undefined
      ? undefined
      : { gameId: game, resourceId: resource.id, fileName: first.original_name ?? first.file_name }
  const form = useFormErrors(edit.failure)
  return (
    <Dialog
      title={t('editTitle')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={editForm(kit, issue)}
          onSubmit={async () => {
            const outcome = await edit.run({ resourceId: resource.id, ...values })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('saved'))
            }
          }}
        >
          <ResourceFields
            values={values}
            complete={false}
            named={named}
            onValuesChange={setValues}
          />
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
