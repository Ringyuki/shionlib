import { Button, Dialog, Empty, Spinner, Stack, Time, Timeline } from '@hina-ui/react'
import { History } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { fileSize, type ResourceFile } from '../resource'
import { useFileHistory } from '../use-file-history'

export function FileHistoryButton({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const { history, loading, load } = useFileHistory(file.id)
  const format = useFormatter()
  const latest = file.latest_history
  if (latest === null) {
    return null
  }
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
    <Dialog
      title={t('historyTitle')}
      description={file.file_name}
      onOpenChange={open => {
        if (open) {
          load()
        }
      }}
      renderContent={() => (
        <Stack gap="md" className="min-h-24">
          {loading && history === undefined && <Spinner />}
          {history !== undefined && entries.length === 0 && (
            <Empty title={t('historyEmpty')} size="sm" />
          )}
          {entries.length > 0 && (
            <Timeline
              items={entries}
              renderTime={({ item }) => <Time value={item.time} format="datetime" />}
            />
          )}
        </Stack>
      )}
    >
      <Button variant="link" tone="neutral" size="sm" icon={<History />} className="ms-1 text-xs">
        {t.rich('replaced', { time: () => <Time value={latest.created} format="relative" /> })}
      </Button>
    </Dialog>
  )
}
