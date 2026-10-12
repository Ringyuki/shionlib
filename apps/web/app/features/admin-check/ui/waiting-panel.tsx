import { AlertDialog, Panel, Time, toast } from '@hina-ui/react'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Deadline, RecordTable, UserRef, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import type { Decision, ScanCase } from '../admin-check'
import { useCaseReview } from '../use-case-review'
import { Detections, FileCell, RowActions } from './check-cells'

type WaitingPanelProps = {
  cases: ScanCase[]
  onOpen: (scanCase: ScanCase) => void
}

type Asked = { scanCase: ScanCase; decision: Decision }

export function WaitingPanel({ cases, onOpen }: WaitingPanelProps) {
  const t = useTranslations('adminCheck')
  const shared = useTranslations('admin')
  const [asked, setAsked] = useState<Asked>()
  const shown = useLast(asked)
  const review = useCaseReview()
  const columns: RecordColumn[] = [
    { key: 'file', label: t('column.file'), fill: true },
    { key: 'found', label: t('column.found'), wide: true },
    { key: 'uploader', label: t('column.uploader'), wide: true },
    { key: 'scanned', label: t('column.scanned'), wide: true },
    { key: 'deadline', label: t('column.deadline'), wide: true },
    { key: 'actions', label: t('column.actions'), wide: true, align: 'end' },
  ]
  return (
    <Panel
      title={t('waiting.title')}
      description={t('waiting.description')}
      count={cases.length}
      padded={false}
    >
      <RecordTable
        label={t('waiting.title')}
        rows={cases}
        rowKey={scanCase => scanCase.id}
        columns={columns}
        empty={t('waiting.empty')}
        emptyIcon={<ShieldCheck />}
        onOpen={onOpen}
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
              return <Detections names={scanCase.detected_viruses ?? []} />
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
                    onClick={() => setAsked({ scanCase, decision: 'ALLOW' })}
                  >
                    {t('decision.ALLOW')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    tone="danger"
                    onClick={() => setAsked({ scanCase, decision: 'DELETE' })}
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
          name: shown?.scanCase.file_name ?? '',
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
          await review.confirm({
            id: asked.scanCase.id,
            decision: asked.decision,
            note: '',
            notify: true,
          })
          toast.success(t('reviewed', { decision: asked.decision }))
        }}
      />
    </Panel>
  )
}
