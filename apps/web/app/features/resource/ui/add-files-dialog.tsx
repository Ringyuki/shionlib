import { Dialog, Form, type FormHandle } from '@hina-ui/react'
import { useRef } from 'react'
import { useTranslations } from 'use-intl'
import { admit } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
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
  const issue = useTranslations('resource.issue')
  const form = useRef<FormHandle>(null)
  const allowance = useAllowance(open)
  const start = useStartUpload()
  const [values, setValues] = useOpenState<AddFilesValues>(open, () => ({ files: [] }))
  const admission = admit(allowance, values.files)
  return (
    <Dialog
      title={t('addFiles')}
      description={t('addFilesDescription')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={addFilesForm(issue)}
          onSubmit={() => {
            if (admission === undefined) {
              start.append(resource, values.files)
              close()
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
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" onClick={close}>
            {t('cancel')}
          </Button>
          <Button disabled={admission !== undefined} onClick={() => void form.current?.submit()}>
            {t('uploadStart')}
          </Button>
        </>
      )}
    />
  )
}
