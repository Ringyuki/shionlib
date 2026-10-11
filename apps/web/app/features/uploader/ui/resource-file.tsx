import { FileState, fileState, type ResourceFile } from '~/features/resource'
import { useBytes } from '~/shared/i18n/use-bytes'
import { FileLine } from './file-line'

type ResourceFileLineProps = {
  file: ResourceFile
  to?: string
}

export function ResourceFileLine({ file, to }: ResourceFileLineProps) {
  const bytes = useBytes()
  return (
    <FileLine
      name={file.file_name}
      size={bytes(file.file_size)}
      to={file.stage === 'stored' ? to : undefined}
      state={fileState(file) === 'passed' ? undefined : <FileState file={file} />}
    />
  )
}
