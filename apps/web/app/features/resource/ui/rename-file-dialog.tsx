import { Dialog, Form, FormField, Input, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
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
  const rename = useRenameFile()
  const form = useFormErrors(rename.failure)
  return (
    <Dialog
      title={t('renameFileTitle')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={renameFileForm(kit)}
          onSubmit={async () => {
            const outcome = await rename.run({ fileId: file.id, name: values.name })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('fileRenamed'))
            }
          }}
        >
          <FormField name="name" label={t('fileName')} required>
            <Input value={values.name} onValueChange={name => setValues({ name })} />
          </FormField>
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
