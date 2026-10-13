import { Heading, Inline, Stack, Text } from '@hina-ui/react'
import { DownloadButton } from '~/features/download'
import { ScanNote, type Inspection } from '~/features/inspection'
import { useBytes } from '~/shared/i18n/use-bytes'
import { downloadable, fileState, type ResourceFile } from '../resource'
import { pendingState } from '../resource-page'
import { FileState } from './file-state'

type PageFileProps = {
  resourceId: number
  file: ResourceFile
  inspection: Inspection | undefined
  leading: boolean
}

export function PageFile({ resourceId, file, inspection, leading }: PageFileProps) {
  const bytes = useBytes()
  return (
    <Stack gap="sm" className="sm:flex-row sm:items-start sm:gap-4">
      <Stack gap="xs" className="min-w-0 flex-1">
        <Heading level={leading ? 1 : 2} size="lg" className="break-words">
          {file.file_name}
        </Heading>
        <Inline gap="sm" align="center" className="gap-y-1">
          <Text as="span" size="sm" className="tabular-nums">
            {bytes(file.file_size)}
          </Text>
          <FileState file={file} explained={pendingState(file) !== undefined} />
          {fileState(file) === 'passed' && <ScanNote inspection={inspection} />}
        </Inline>
      </Stack>
      <DownloadButton
        resourceId={resourceId}
        file={file}
        disabled={!downloadable(file)}
        size="md"
        block
        className="max-sm:w-full"
      />
    </Stack>
  )
}
