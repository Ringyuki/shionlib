import { FileState, fileState, type ResourceFile } from '~/features/resource'
import { useBytes } from '~/shared/i18n/use-bytes'
import { FileLine } from './file-line'

export function ResourceFileLine({ file }: { file: ResourceFile }) {
  const bytes = useBytes()
  return (
    <FileLine
      name={file.file_name}
      size={bytes(file.file_size)}
      state={fileState(file) === 'passed' ? undefined : <FileState file={file} />}
    />
  )
}
