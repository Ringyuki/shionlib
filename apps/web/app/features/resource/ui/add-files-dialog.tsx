import { Dialog, Form, Inline } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { admit } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import type { Resource } from '../resource'
import { addFilesForm, type AddFilesValues } from '../resource.schema'
import { useAllowance } from '../use-allowance'
import { useStartUpload } from '../use-start-upload'
import { UploadFilesField } from './upload-files-field'

type AddFilesDialogProps = {
  resource: Resource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFilesDialog({ resource, open, onOpenChange }: AddFilesDialogProps) {
  const t = useTranslations('resource')
  return (
    <Dialog
      title={t('addFiles')}
      description={t('addFilesDescription')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => <AddFilesForm resource={resource} onDone={close} />}
    />
  )
}

function AddFilesForm({ resource, onDone }: { resource: Resource; onDone: () => void }) {
  const t = useTranslations('resource')
  const issue = useTranslations('resource.issue')
  const allowance = useAllowance()
  const start = useStartUpload()
  const [values, setValues] = useState<AddFilesValues>({ files: [] })
  const admission = admit(allowance, values.files)
  return (
    <Form
      values={values}
      rules={addFilesForm(issue)}
      onSubmit={() => {
        if (admission === undefined) {
          start.append(resource, values.files)
          onDone()
        }
      }}
    >
      <UploadFilesField
        allowance={allowance}
        admission={admission}
        multiple
        files={values.files}
        onFilesChange={files => setValues({ files })}
      />
      <Inline gap="sm" justify="end">
        <Button variant="ghost" tone="neutral" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type="submit">{t('uploadStart')}</Button>
      </Inline>
    </Form>
  )
}
