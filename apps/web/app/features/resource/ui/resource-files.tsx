import {
  CopyButton,
  IconButton,
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
import { FileArchive, FileUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { DownloadButton } from '~/features/download'
import { useBytes } from '~/shared/i18n/use-bytes'
import { fileState, shortHash, stored, type ResourceFile } from '../resource'
import { FileState } from './file-state'
import { ReplaceFileDialog } from './replace-file-dialog'

const wide = 'max-sm:hidden'

type ResourceFilesProps = {
  files: readonly ResourceFile[]
  manageable: boolean
}

export function ResourceFiles({ files, manageable }: ResourceFilesProps) {
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
          <FileRow key={file.id} file={file} replaceable={manageable && stored(file)} />
        ))}
      </TableBody>
    </Table>
  )
}

function FileRow({ file, replaceable }: { file: ResourceFile; replaceable: boolean }) {
  const t = useTranslations('resource')
  const [replacing, setReplacing] = useState(false)
  const bytes = useBytes()
  const sizeText = bytes(file.file_size)
  const state = fileState(file)
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
          <FileState file={file} />
        </Inline>
      </TableCell>
      <TableCell align="end" className={`${wide} whitespace-nowrap`}>
        <Text as="span" size="sm" tone="muted">
          {sizeText}
        </Text>
      </TableCell>
      <TableCell className={`${wide} whitespace-nowrap`}>
        <Inline gap="none" align="center" wrap={false}>
          <Text as="span" size="xs" tone="faint" className="font-mono">
            {shortHash(file.file_hash)}
          </Text>
          <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" />
        </Inline>
      </TableCell>
      <TableCell align="end" className="pe-0">
        <Inline gap="xs" align="center" justify="end" wrap={false}>
          {replaceable && (
            <>
              <IconButton label={t('replaceFile')} size="sm" onClick={() => setReplacing(true)}>
                <FileUp />
              </IconButton>
              <ReplaceFileDialog file={file} open={replacing} onOpenChange={setReplacing} />
            </>
          )}
          <DownloadButton
            file={{ id: file.id, name: file.file_name }}
            disabled={state === 'scanning' || state === 'risky'}
          />
        </Inline>
      </TableCell>
    </TableRow>
  )
}
