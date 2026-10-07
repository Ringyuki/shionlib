import { Progress } from '@hina-ui/react'
import { progress, type Upload } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import { FileLine } from './file-line'
import { UploadTag } from './upload-tag'

const tones = {
  queued: 'accent',
  needsFile: 'warning',
  running: 'accent',
  waiting: 'warning',
  paused: 'accent',
  done: 'success',
  failed: 'danger',
} as const

export function TransferFile({ upload }: { upload: Upload }) {
  const bytes = useBytes()
  const name = upload.name ?? upload.file.name
  return (
    <FileLine
      name={name}
      size={bytes(upload.file.size)}
      state={<UploadTag upload={upload} />}
      bar={
        <Progress
          size="sm"
          aria-label={name}
          tone={tones[upload.phase.name]}
          value={progress(upload)}
        />
      }
    />
  )
}
