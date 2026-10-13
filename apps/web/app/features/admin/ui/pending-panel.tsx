import { Link, Panel, Text, Time } from '@hina-ui/react'
import { CircleCheck } from 'lucide-react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths, type Pending } from '../admin'
import { pendingTotal, unlisted, type QueueEntry, type QueueKind } from '../admin-queue'
import { Deadline } from './deadline'
import { KindTag, QueueContent, QueueSubmitter } from './pending-cells'
import { RecordTable, type RecordColumn } from './record-table'

const lists: Record<QueueKind, string> = {
  malware: adminPaths.checks,
  stalled: adminPaths.checks,
  report: adminPaths.reports,
  comment: adminPaths.comments,
  walkthrough: `${adminPaths.walkthroughs}?status=HELD`,
}

type PendingPanelProps = {
  queue: QueueEntry[]
  pending: Pending
}

export function PendingPanel({ queue, pending }: PendingPanelProps) {
  const t = useTranslations('admin.overview.pending')
  const navigate = useNavigate()
  const rest = unlisted(queue, pending)
  const columns: RecordColumn[] = [
    { key: 'kind', label: t('column.kind') },
    { key: 'content', label: t('column.content'), fill: true },
    { key: 'submitter', label: t('column.submitter'), wide: true },
    { key: 'submitted', label: t('column.submitted'), wide: true },
    { key: 'deadline', label: t('column.deadline'), wide: true },
  ]
  return (
    <Panel title={t('title')} count={pendingTotal(pending)} padded={false}>
      <RecordTable
        label={t('title')}
        rows={queue}
        rowKey={entry => entry.key}
        columns={columns}
        empty={t('empty')}
        emptyIcon={<CircleCheck />}
        onOpen={entry => void navigate(entry.to)}
        renderCell={(entry, column) => {
          switch (column) {
            case 'kind':
              return <KindTag kind={entry.kind} />
            case 'content':
              return <QueueContent entry={entry} />
            case 'submitter':
              return <QueueSubmitter entry={entry} />
            case 'submitted':
              return <Time value={entry.at} format="relative" className="text-muted text-sm" />
            default:
              return entry.deadline === undefined ? null : (
                <Deadline
                  at={entry.deadline}
                  outcome={entry.kind === 'malware' ? 'autoDelete' : 'autoRemove'}
                />
              )
          }
        }}
        footer={
          queue.length === 0 ? undefined : (
            <>
              <Text as="span" size="sm" tone="muted">
                {rest.length === 0
                  ? t('order')
                  : t('rest', {
                      items: rest
                        .map(({ kind, count }) => t(`restOf.${kind}`, { count }))
                        .join(t('separator')),
                    })}
              </Text>
              {[...new Set(rest.map(({ kind }) => lists[kind]))].map(to => (
                <Link key={to} asChild className="text-sm">
                  <RouterLink to={to} prefetch="intent">
                    {t(`all.${rest.find(({ kind }) => lists[kind] === to)?.kind ?? 'report'}`)}
                  </RouterLink>
                </Link>
              ))}
            </>
          )
        }
      />
    </Panel>
  )
}
