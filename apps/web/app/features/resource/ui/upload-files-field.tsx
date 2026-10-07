import { Alert, FileUpload, FormField } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { chosenFiles, fileLimit, type Admission, type Allowance } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import { useAdmissionMessage } from '../use-admission-message'
import { StorageMeter } from './storage-meter'

type UploadFilesFieldProps = {
  allowance: Allowance | undefined
  admission: Admission | undefined
  multiple: boolean
  files: File[]
  onFilesChange: (files: File[]) => void
}

export function UploadFilesField({
  allowance,
  admission,
  multiple,
  files,
  onFilesChange,
}: UploadFilesFieldProps) {
  const t = useTranslations('resource')
  const bytes = useBytes()
  const message = useAdmissionMessage()
  const rule =
    allowance === undefined
      ? undefined
      : t(allowance.stored_limit === null ? 'fileLimitNoQuota' : 'fileLimit', {
          limit: bytes(fileLimit(allowance)),
        })
  return (
    <>
      <FormField name="files" label={t('uploadFiles')} description={rule} required>
        <FileUpload
          multiple={multiple}
          value={multiple ? files : (files[0] ?? null)}
          onValueChange={value => onFilesChange(chosenFiles(value))}
        >
          {t('uploadDrop')}
        </FileUpload>
      </FormField>
      {allowance !== undefined && allowance.stored_limit !== null && (
        <StorageMeter
          limit={allowance.stored_limit}
          stored={allowance.stored}
          uploading={allowance.in_flight}
          chosen={files.reduce((sum, file) => sum + file.size, 0)}
        />
      )}
      <Alert tone="danger" open={admission !== undefined}>
        {admission === undefined ? '' : message(admission)}
      </Alert>
    </>
  )
}
