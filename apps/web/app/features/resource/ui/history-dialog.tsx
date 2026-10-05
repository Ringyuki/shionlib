import { Dialog, Empty, Section, Spinner, Stack, Time, Timeline } from '@hina-ui/react'
import { useEffect } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { fileSize, type ResourceFile } from '../resource'
import { useFileHistory } from '../use-file-history'

type HistoryDialogProps = {
  files: readonly ResourceFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistoryDialog({ files, open, onOpenChange }: HistoryDialogProps) {
  const t = useTranslations('resource')
  return (
    <Dialog
      title={t('historyTitle')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Stack gap="lg" className="min-h-24">
          {files.map(file => (
            <FileHistory key={file.id} file={file} titled={files.length > 1} />
          ))}
        </Stack>
      )}
    />
  )
}

function FileHistory({ file, titled }: { file: ResourceFile; titled: boolean }) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const { history, loading, load } = useFileHistory(file.id)
  useEffect(() => {
    load()
  }, [load])
  const entries = (history ?? []).map(entry => {
    const size = fileSize(entry.file_size)
    return {
      id: entry.id,
      title: t('historyEntry', {
        name: entry.operator.name,
        size: `${format.number(size.value, { maximumFractionDigits: 2 })} ${size.unit}`,
      }),
      description: entry.reason ?? undefined,
      time: entry.created,
    }
  })
  return (
    <Section title={titled ? file.file_name : undefined}>
      {loading && history === undefined && <Spinner size="sm" />}
      {history !== undefined && entries.length === 0 && (
        <Empty title={t('historyEmpty')} size="sm" />
      )}
      {entries.length > 0 && (
        <Timeline
          items={entries}
          renderTime={({ item }) => <Time value={item.time} format="datetime" />}
          renderDescription={({ item }) =>
            item.description === undefined ? null : (
              <BBCodeText source={item.description} size="inherit" tone="muted" />
            )
          }
        />
      )}
    </Section>
  )
}
