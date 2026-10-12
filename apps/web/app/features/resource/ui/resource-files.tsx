import {
  CopyButton,
  Inline,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@hina-ui/react'
import { FileArchive } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { DownloadButton } from '~/features/download'
import { useBytes } from '~/shared/i18n/use-bytes'
import { downloadable, shortHash, type ResourceFile } from '../resource'
import { FileMenu } from './file-menu'
import { FileState } from './file-state'

const wide = 'max-sm:hidden'

type ResourceFilesProps = {
  resourceId: number
  files: readonly ResourceFile[]
  manageable: boolean
}

export function ResourceFiles({ resourceId, files, manageable }: ResourceFilesProps) {
  const t = useTranslations('resource.column')
  return (
    <Table variant="secondary" hover={false} className="[&_tbody_tr:last-child]:border-0">
      <TableHeader className="sr-only">
        <TableRow>
          <TableHead>{t('file')}</TableHead>
          <TableHead>{t('size')}</TableHead>
          <TableHead className={wide}>{t('hash')}</TableHead>
          <TableHead>{t('download')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map(file => (
          <FileRow
            key={file.id}
            resourceId={resourceId}
            file={file}
            manageable={manageable}
            removable={files.length > 1}
          />
        ))}
      </TableBody>
    </Table>
  )
}

type FileRowProps = {
  resourceId: number
  file: ResourceFile
  manageable: boolean
  removable: boolean
}

function FileRow({ resourceId, file, manageable, removable }: FileRowProps) {
  const t = useTranslations('resource')
  const bytes = useBytes()
  const sizeText = bytes(file.file_size)
  return (
    <TableRow>
      <TableCell className="w-full max-w-0 ps-0">
        <Inline gap="sm" align="center" className="gap-y-1">
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
          <FileState file={file} className="pointer-events-auto" />
        </Inline>
      </TableCell>
      <TableCell align="end" className={`${wide} whitespace-nowrap`}>
        <Text as="span" size="sm" tone="muted">
          {sizeText}
        </Text>
      </TableCell>
      <TableCell className={`${wide} whitespace-nowrap`}>
        <Inline gap="none" align="center" wrap={false} className="pointer-events-auto">
          <Text as="span" size="xs" tone="faint" className="font-mono">
            {shortHash(file.file_hash)}
          </Text>
          <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" />
        </Inline>
      </TableCell>
      <TableCell align="end" className="pe-0">
        <Inline gap="xs" align="center" justify="end" wrap={false} className="pointer-events-auto">
          {downloadable(file) && <DownloadButton resourceId={resourceId} file={file} />}
          {manageable && <FileMenu file={file} removable={removable} />}
        </Inline>
      </TableCell>
    </TableRow>
  )
}
