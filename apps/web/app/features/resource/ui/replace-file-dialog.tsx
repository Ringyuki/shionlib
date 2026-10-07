import { Dialog, Form, FormField, Inline, Textarea } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { admit } from '~/features/upload'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import type { ResourceFile } from '../resource'
import { replaceForm, type ReplaceValues } from '../resource.schema'
import { useAllowance } from '../use-allowance'
import { useStartUpload } from '../use-start-upload'
import { UploadFilesField } from './upload-files-field'

type ReplaceFileDialogProps = {
  file: ResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReplaceFileDialog({ file, open, onOpenChange }: ReplaceFileDialogProps) {
  const t = useTranslations('resource')
  return (
    <Dialog
      title={t('replaceFile')}
      description={t('replaceDescription', { name: file.file_name })}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => <ReplaceFileForm file={file} onDone={close} />}
    />
  )
}

function ReplaceFileForm({ file, onDone }: { file: ResourceFile; onDone: () => void }) {
  const t = useTranslations('resource')
  const issue = useTranslations('resource.issue')
  const kit = useFormKit()
  const allowance = useAllowance()
  const start = useStartUpload()
  const [values, setValues] = useState<ReplaceValues>({ files: [], reason: '' })
  const admission = admit(allowance, values.files)
  return (
    <Form
      values={values}
      rules={replaceForm(kit, issue)}
      onSubmit={() => {
        const [replacement] = values.files
        if (replacement !== undefined && admission === undefined) {
          start.replace(file, replacement, values.reason)
          onDone()
        }
      }}
    >
      <UploadFilesField
        allowance={allowance}
        admission={admission}
        multiple={false}
        files={values.files}
        onFilesChange={files => setValues({ ...values, files })}
      />
      <FormField
        name="reason"
        label={t('replaceReason')}
        description={t('optionalHint', lengthOf('DownloadReuploadInputBody', 'reason'))}
      >
        <Textarea
          value={values.reason}
          onValueChange={reason => setValues({ ...values, reason })}
          autosize={{ minRows: 2, maxRows: 6 }}
        />
      </FormField>
      <Inline gap="sm" justify="end">
        <Button variant="ghost" tone="neutral" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type="submit">{t('uploadStart')}</Button>
      </Inline>
    </Form>
  )
}
