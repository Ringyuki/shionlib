import { Alert, Dialog, Form, FormField, Inline, Input, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
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
  const [values, setValues] = useState<RenameFileValues>({ name: file.file_name })
  const rename = useRenameFile(() => {
    onOpenChange(false)
    toast.success(t('fileRenamed'))
  })
  const { form, message } = useSubmissionFeedback(rename.failure)
  const changeOpen = (next: boolean) => {
    if (next) {
      setValues({ name: file.file_name })
    }
    onOpenChange(next)
  }
  return (
    <Dialog
      title={t('renameFileTitle')}
      open={open}
      onOpenChange={changeOpen}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={renameFileForm(kit)}
          onSubmit={() => rename.submit({ fileId: file.id, name: values.name })}
        >
          {({ submitting }) => (
            <>
              <FormField name="name" label={t('fileName')} required>
                <Input value={values.name} onValueChange={name => setValues({ name })} />
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
