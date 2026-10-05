import { CopyButton, Inline, Stack, Text } from '@hina-ui/react'
import { FileArchive } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { DownloadButton } from '~/features/download'
import { fileSize, fileState, shortHash, type ResourceFile } from '../resource'
import { FileHistoryButton } from './file-history-button'
import { FileState } from './file-state'

export function ResourceFiles({ files }: { files: readonly ResourceFile[] }) {
  const t = useTranslations('resource')
  return (
    <Stack
      as="ul"
      aria-label={t('files')}
      gap="none"
      className="m-0 list-none divide-y divide-line border-t border-line p-0"
    >
      {files.map(file => (
        <FileRow key={file.id} file={file} />
      ))}
    </Stack>
  )
}

function FileRow({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const size = fileSize(file.file_size)
  const algorithm = file.hash_algorithm === 'blake3' ? 'BLAKE3' : 'SHA-256'
  return (
    <Inline as="li" gap="md" align="center" wrap={false} className="px-5 py-3">
      <FileArchive aria-hidden className="size-5 shrink-0 text-faint max-sm:hidden" />
      <Stack gap="none" className="min-w-0 flex-1">
        <Inline gap="sm" align="center" wrap={false} className="min-w-0">
          <Text size="sm" weight="medium" truncate title={file.file_name}>
            {file.file_name}
          </Text>
          <FileState file={file} />
        </Inline>
        <Inline gap="xs" align="center">
          <Text size="xs" tone="muted" className="tabular-nums">
            {format.number(size.value, { maximumFractionDigits: size.unit === 'B' ? 0 : 2 })}{' '}
            {size.unit}
          </Text>
          <Inline gap="xs" align="center" wrap={false} className="max-sm:hidden">
            <Text size="xs" tone="faint" aria-hidden>
              ·
            </Text>
            <Text size="xs" tone="muted" className="font-mono">
              {t('hash', { algorithm, hash: shortHash(file.file_hash) })}
            </Text>
            <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" className="-my-1.5" />
          </Inline>
          <FileHistoryButton file={file} />
        </Inline>
      </Stack>
      <FileAction file={file} />
    </Inline>
  )
}

function FileAction({ file }: { file: ResourceFile }) {
  const state = fileState(file)
  return (
    <DownloadButton
      file={{ id: file.id, name: file.file_name }}
      disabled={state === 'scanning' || state === 'risky'}
    />
  )
}
