import { cn, CopyButton, Divider, Grid, Inline, Stack, Text } from '@hina-ui/react'
import { FileArchive } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslations } from 'use-intl'
import { DownloadButton } from '~/features/download'
import { useBytes } from '~/shared/i18n/use-bytes'
import { downloadable, shortHash, type AwaitedVolumes, type ResourceFile } from '../resource'
import { FileMenu } from './file-menu'
import { FileState } from './file-state'
import { listColumns } from './list-columns'

type ResourceFilesProps = {
  resourceId: number
  files: readonly ResourceFile[]
  awaited: AwaitedVolumes | undefined
  manageable: boolean
}

export function ResourceFiles({ resourceId, files, awaited, manageable }: ResourceFilesProps) {
  return (
    <Grid role="list" className={cn(listColumns.span, 'gap-y-0')}>
      {files.map((file, index) => (
        <Fragment key={file.id}>
          {index > 0 && <Divider decorative className="col-span-full" />}
          <FileRow
            resourceId={resourceId}
            file={file}
            awaited={awaited}
            manageable={manageable}
            removable={files.length > 1}
          />
        </Fragment>
      ))}
    </Grid>
  )
}

type FileRowProps = {
  resourceId: number
  file: ResourceFile
  awaited: AwaitedVolumes | undefined
  manageable: boolean
  removable: boolean
}

function FileRow({ resourceId, file, awaited, manageable, removable }: FileRowProps) {
  const t = useTranslations('resource')
  const bytes = useBytes()
  const sizeText = bytes(file.file_size)
  return (
    <Grid role="listitem" className={cn(listColumns.span, 'min-h-11 items-center py-1')}>
      <Inline gap="sm" align="center" className={cn(listColumns.name, 'gap-y-1')}>
        <Inline gap="xs" align="start" wrap={false} className="max-w-full min-w-0">
          <FileArchive aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
          <Stack gap="none" className="min-w-0">
            <Text size="sm" className="break-words">
              {file.file_name}
            </Text>
            <Text size="xs" tone="muted" className="sm:hidden">
              {sizeText}
            </Text>
          </Stack>
        </Inline>
        <FileState file={file} awaited={awaited} className="pointer-events-auto" />
      </Inline>
      <Text as="span" size="sm" tone="muted" className={listColumns.size}>
        {sizeText}
      </Text>
      <Inline
        gap="none"
        align="center"
        wrap={false}
        className={cn(listColumns.hash, 'pointer-events-auto')}
      >
        <Text as="span" size="xs" tone="faint" className="font-mono">
          {shortHash(file.file_hash)}
        </Text>
        <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" />
      </Inline>
      <Inline
        gap="xs"
        align="center"
        justify="end"
        wrap={false}
        className={cn(listColumns.action, 'pointer-events-auto')}
      >
        {downloadable(file) && <DownloadButton resourceId={resourceId} file={file} />}
        {manageable && <FileMenu file={file} removable={removable} />}
      </Inline>
    </Grid>
  )
}
