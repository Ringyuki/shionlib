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
  VisuallyHidden,
} from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { DownloadButton } from '~/features/download'
import { fileSize, fileState, shortHash, type ResourceFile } from '../resource'
import { FileState } from './file-state'

const wide = 'max-sm:hidden'

const algorithmName = { sha256: 'SHA-256', blake3: 'BLAKE3' } as const satisfies Record<
  ResourceFile['hash_algorithm'],
  string
>

export function ResourceFiles({ files }: { files: readonly ResourceFile[] }) {
  const t = useTranslations('resource.column')
  const algorithms = new Set(files.map(file => file.hash_algorithm))
  const [algorithm] = algorithms
  const hashHeading =
    algorithms.size === 1 && algorithm !== undefined ? algorithmName[algorithm] : t('hash')
  return (
    <Table variant="secondary" hover={false}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('file')}</TableHead>
          <TableHead className={wide}>{t('size')}</TableHead>
          <TableHead className={wide}>{hashHeading}</TableHead>
          <TableHead className={wide}>{t('scan')}</TableHead>
          <TableHead align="end">
            <VisuallyHidden>{t('download')}</VisuallyHidden>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map(file => (
          <FileRow key={file.id} file={file} />
        ))}
      </TableBody>
    </Table>
  )
}

function FileRow({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const size = fileSize(file.file_size)
  const sizeText = `${format.number(size.value, { maximumFractionDigits: size.unit === 'B' ? 0 : 2 })} ${size.unit}`
  const state = fileState(file)
  return (
    <TableRow>
      <TableCell className="max-w-0 w-full">
        <Stack gap="xs">
          <Text size="sm" truncate title={file.file_name}>
            {file.file_name}
          </Text>
          <Inline gap="sm" align="center" className="sm:hidden">
            <Text size="xs" tone="muted" className="tabular-nums">
              {sizeText}
            </Text>
            <FileState file={file} />
          </Inline>
        </Stack>
      </TableCell>
      <TableCell className={`${wide} whitespace-nowrap`}>{sizeText}</TableCell>
      <TableCell className={`${wide} whitespace-nowrap`}>
        <Inline gap="none" align="center" wrap={false}>
          <Text as="span" size="xs" tone="muted" className="font-mono">
            {shortHash(file.file_hash)}
          </Text>
          <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" />
        </Inline>
      </TableCell>
      <TableCell className={wide}>
        <FileState file={file} />
      </TableCell>
      <TableCell align="end">
        <DownloadButton
          file={{ id: file.id, name: file.file_name }}
          disabled={state === 'scanning' || state === 'risky'}
        />
      </TableCell>
    </TableRow>
  )
}
