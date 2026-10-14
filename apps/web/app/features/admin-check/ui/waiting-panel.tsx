import { AlertDialog, Panel, Time, toast } from '@hina-ui/react'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Deadline, RecordTable, UserRef, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import type { Decision, ScanCase } from '../admin-check'
import { useQuickReview } from '../use-quick-review'
import { BulkBar } from './bulk-bar'
import { Detections, FileCell, fileWidth, RowActions, userWidth } from './check-cells'

type WaitingPanelProps = {
  cases: ScanCase[]
  onOpen: (scanCase: ScanCase) => void
}

type Asked = { ids: number[]; name: string; decision: Decision }

export function WaitingPanel({ cases, onOpen }: WaitingPanelProps) {
  const t = useTranslations('adminCheck')
  const shared = useTranslations('admin')
  const [selected, setSelected] = useState<number[]>([])
  const [asked, setAsked] = useState<Asked>()
  const shown = useLast(asked)
  const review = useQuickReview()
  const chosen = selected.filter(id => cases.some(scanCase => scanCase.id === id))
  const columns: RecordColumn[] = [
    { key: 'file', label: t('column.file'), fill: true, minWidth: fileWidth },
    { key: 'found', label: t('column.found'), wide: true },
    { key: 'uploader', label: t('column.uploader'), wide: true, minWidth: userWidth },
    { key: 'scanned', label: t('column.scanned'), wide: true },
    { key: 'deadline', label: t('column.deadline'), wide: true },
    { key: 'actions', label: t('column.actions'), wide: true, align: 'end', pin: 'end' },
  ]
  const ask = (decision: Decision) =>
    setAsked({
      ids: chosen,
      name: cases.find(scanCase => scanCase.id === chosen[0])?.file_name ?? '',
      decision,
    })
  const decide = (scanCase: ScanCase, decision: Decision) =>
    setAsked({ ids: [scanCase.id], name: scanCase.file_name, decision })
  return (
    <Panel
      title={t('waiting.title')}
      description={t('waiting.description')}
      count={cases.length}
      padded={false}
      actions={
        chosen.length > 0 && (
          <BulkBar count={chosen.length} onClear={() => setSelected([])}>
            <Button size="sm" variant="outline" tone="neutral" onClick={() => ask('ALLOW')}>
              {t('decision.ALLOW')}
            </Button>
            <Button size="sm" variant="outline" tone="danger" onClick={() => ask('DELETE')}>
              {t('decision.DELETE')}
            </Button>
          </BulkBar>
        )
      }
    >
      <RecordTable
        label={t('waiting.title')}
        rows={cases}
        rowKey={scanCase => scanCase.id}
        columns={columns}
        empty={t('waiting.empty')}
        emptyIcon={<ShieldCheck />}
        onOpen={onOpen}
        selected={chosen}
        onSelectedChange={keys =>
          setSelected(cases.map(scanCase => scanCase.id).filter(id => keys.includes(id)))
        }
        renderCell={(scanCase, column) => {
          switch (column) {
            case 'file':
              return (
                <FileCell
                  name={scanCase.file_name}
                  size={scanCase.file_size}
                  game={scanCase.resource?.game}
                  narrow={<Deadline at={scanCase.review_deadline} outcome="autoDelete" />}
                />
              )
            case 'found':
              return <Detections names={scanCase.detected_viruses ?? []} wrap={false} />
            case 'uploader':
              return <UserRef user={scanCase.uploader} />
            case 'scanned':
              return (
                <Time value={scanCase.created} format="relative" className="text-muted text-sm" />
              )
            case 'deadline':
              return <Deadline at={scanCase.review_deadline} outcome="autoDelete" />
            default:
              return (
                <RowActions>
                  <Button
                    size="sm"
                    variant="outline"
                    tone="neutral"
                    onClick={() => decide(scanCase, 'ALLOW')}
                  >
                    {t('decision.ALLOW')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    tone="danger"
                    onClick={() => decide(scanCase, 'DELETE')}
                  >
                    {t('decision.DELETE')}
                  </Button>
                </RowActions>
              )
          }
        }}
      />
      <AlertDialog
        title={t('quick.title', {
          decision: shown?.decision ?? 'ALLOW',
          count: shown?.ids.length ?? 1,
          name: shown?.name ?? '',
        })}
        description={t('quick.description', { decision: shown?.decision ?? 'ALLOW' })}
        confirmText={t(`decision.${shown?.decision ?? 'ALLOW'}`)}
        cancelText={shared('cancel')}
        tone={shown?.decision === 'DELETE' ? 'danger' : 'accent'}
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
          await review.confirm({ ids: asked.ids, decision: asked.decision })
          setSelected(current => current.filter(id => !asked.ids.includes(id)))
          toast.success(t('reviewed', { decision: asked.decision, count: asked.ids.length }))
        }}
      />
    </Panel>
  )
}
