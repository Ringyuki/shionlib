import { Alert, Dialog, Form, FormField, Input, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useDialogFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { ResourceFile } from '../resource'
import { renameFileForm, type RenameFileValues } from '../resource.schema'
import { useRenameFile } from '../use-rename-file'

type RenameFileDialogProps = {
  file: ResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenameFileDialog({ file, open, onOpenChange }: RenameFileDialogProps) {
  const t = useTranslations('resource')
  const kit = useFormKit()
  const [values, setValues] = useOpenState<RenameFileValues>(open, () => ({
    name: file.file_name,
  }))
  const rename = useRenameFile(() => {
    onOpenChange(false)
    toast.success(t('fileRenamed'))
  })
  const { form, message } = useDialogFeedback(open, rename.failure)
  return (
    <Dialog
      title={t('renameFileTitle')}
      open={open}
      onOpenChange={onOpenChange}
      locked={rename.pending}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={renameFileForm(kit)}
          onSubmit={() => rename.submit({ fileId: file.id, name: values.name })}
        >
          <FormField name="name" label={t('fileName')} required>
            <Input value={values.name} onValueChange={name => setValues({ name })} />
          </FormField>
          <Alert tone="danger" open={message !== undefined}>
            {message}
          </Alert>
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={rename.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={rename.pending} onClick={() => void form.current?.submit()}>
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
