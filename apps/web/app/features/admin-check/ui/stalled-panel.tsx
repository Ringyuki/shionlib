import { AlertDialog, Panel, Time, toast } from '@hina-ui/react'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Deadline, RecordTable, TwoLines, UserRef, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import type { Stalled } from '../admin-check'
import type { StalledChange } from '../admin-check.schema'
import { useStalledChange } from '../use-stalled-change'
import { BulkBar } from './bulk-bar'
import { FileCell, fileWidth, RowActions, userWidth } from './check-cells'

type Asked = { fileIds: number[]; name: string; action: StalledChange['action'] }

export function StalledPanel({ stalled }: { stalled: Stalled[] }) {
  const t = useTranslations('adminCheck')
  const shared = useTranslations('admin')
  const [selected, setSelected] = useState<number[]>([])
  const [asked, setAsked] = useState<Asked>()
  const shown = useLast(asked)
  const change = useStalledChange()
  const chosen = selected.filter(id => stalled.some(entry => entry.file_id === id))
  const ask = (action: Asked['action']) =>
    setAsked({
      fileIds: chosen,
      name: stalled.find(entry => entry.file_id === chosen[0])?.file_name ?? '',
      action,
    })
  const decide = (entry: Stalled, action: Asked['action']) =>
    setAsked({ fileIds: [entry.file_id], name: entry.file_name, action })
  const columns: RecordColumn[] = [
    { key: 'file', label: t('column.file'), fill: true, minWidth: fileWidth },
    { key: 'reason', label: t('column.reason'), wide: true, className: 'w-[32%] min-w-56' },
    { key: 'uploader', label: t('column.uploader'), wide: true, minWidth: userWidth },
    { key: 'uploaded', label: t('column.uploaded'), wide: true },
    { key: 'deadline', label: t('column.deadline'), wide: true },
    { key: 'actions', label: t('column.actions'), align: 'end', pin: 'end' },
  ]
  const attempts = (entry: Stalled) =>
    t.rich('stalled.attempts', {
      count: entry.failures,
      known: String(entry.stalled_at !== null),
      time: () => <Time value={entry.stalled_at} />,
    })
  return (
    <Panel
      title={t('stalled.title')}
      description={t('stalled.description')}
      count={stalled.length}
      padded={false}
      actions={
        chosen.length > 0 && (
          <BulkBar count={chosen.length} onClear={() => setSelected([])}>
            <Button size="sm" variant="outline" tone="neutral" onClick={() => ask('recheck')}>
              {t('stalled.recheck')}
            </Button>
            <Button size="sm" variant="outline" tone="danger" onClick={() => ask('remove')}>
              {t('stalled.remove')}
            </Button>
          </BulkBar>
        )
      }
    >
      <RecordTable
        label={t('stalled.title')}
        rows={stalled}
        rowKey={entry => entry.file_id}
        columns={columns}
        empty={t('stalled.empty')}
        emptyIcon={<CircleCheck />}
        selected={chosen}
        onSelectedChange={keys =>
          setSelected(stalled.map(entry => entry.file_id).filter(id => keys.includes(id)))
        }
        renderCell={(entry, column) => {
          switch (column) {
            case 'file':
              return (
                <FileCell
                  name={entry.file_name}
                  size={entry.file_size}
                  game={entry.game}
                  narrow={entry.reason}
                />
              )
            case 'reason':
              return <TwoLines first={entry.reason} second={attempts(entry)} />
            case 'uploader':
              return <UserRef user={entry.uploader} />
            case 'uploaded':
              return (
                <Time value={entry.uploaded} format="relative" className="text-muted text-sm" />
              )
            case 'deadline':
              return <Deadline at={entry.deadline} outcome="autoRemove" />
            default:
              return (
                <RowActions>
                  <Button
                    size="sm"
                    variant="outline"
                    tone="neutral"
                    onClick={() => decide(entry, 'recheck')}
                  >
                    {t('stalled.recheck')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    tone="danger"
                    onClick={() => decide(entry, 'remove')}
                  >
                    {t('stalled.remove')}
                  </Button>
                </RowActions>
              )
          }
        }}
      />
      <AlertDialog
        title={t('stalled.confirm', {
          action: shown?.action ?? 'recheck',
          count: shown?.fileIds.length ?? 1,
          name: shown?.name ?? '',
        })}
        description={t('stalled.confirmHint', { action: shown?.action ?? 'recheck' })}
        confirmText={t(`stalled.${shown?.action ?? 'recheck'}`)}
        cancelText={shared('cancel')}
        tone={shown?.action === 'remove' ? 'danger' : 'accent'}
        open={asked !== undefined}
        onOpenChange={open => {
          if (!open) {
            setAsked(undefined)
          }
        }}
        onConfirm={async () => {
          if (asked === undefined) {
            return
          }
          await change.confirm({ fileIds: asked.fileIds, action: asked.action })
          setSelected(current => current.filter(id => !asked.fileIds.includes(id)))
          toast.success(t('stalled.done', { action: asked.action, count: asked.fileIds.length }))
        }}
      />
    </Panel>
  )
}
