import { AlertDialog, Panel, Text, Time, toast } from '@hina-ui/react'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import type { Session, UserDetail } from '../admin-user'
import { useUserChange } from '../use-user-change'

type SessionsPanelProps = {
  detail: UserDetail
  sessions: Session[]
  total: number
  manageable: boolean
}

export function SessionsPanel({ detail, sessions, total, manageable }: SessionsPanelProps) {
  const t = useTranslations('adminUser.sessions')
  const shared = useTranslations('admin')
  const [asking, setAsking] = useState(false)
  const change = useUserChange()
  const columns: RecordColumn[] = [
    { key: 'device', label: t('device'), fill: true },
    { key: 'ip', label: t('ip'), wide: true },
    { key: 'used', label: t('used'), wide: true },
    { key: 'created', label: t('created') },
  ]
  return (
    <Panel
      title={t('title')}
      count={total}
      padded={false}
      actions={
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          icon={<LogOut />}
          disabled={!manageable || total === 0}
          onClick={() => setAsking(true)}
        >
          {t('endAll')}
        </Button>
      }
    >
      <RecordTable
        label={t('title')}
        rows={sessions}
        rowKey={session => session.id}
        columns={columns}
        empty={t('empty')}
        footer={
          total > sessions.length ? (
            <Text as="span" size="sm" tone="muted">
              {t('more', { shown: sessions.length, total })}
            </Text>
          ) : undefined
        }
        renderCell={(session, column) => {
          switch (column) {
            case 'device':
              return (
                <TwoLines
                  first={session.device_info ?? session.user_agent ?? t('unknownDevice')}
                  second={
                    session.device_info === null ? undefined : (session.user_agent ?? undefined)
                  }
                  narrow={session.ip ?? undefined}
                />
              )
            case 'ip':
              return (
                <Text as="span" size="sm" className="font-mono">
                  {session.ip ?? t('unknownIp')}
                </Text>
              )
            case 'used':
              return (
                <Time
                  value={session.last_used_at ?? session.created}
                  format="relative"
                  className="text-muted text-sm"
                />
              )
            default:
              return <Time value={session.created} format="date" className="text-muted text-sm" />
          }
        }}
      />
      <AlertDialog
        title={t('endAllConfirm', { name: detail.name })}
        description={t('endAllHint')}
        confirmText={t('endAll')}
        cancelText={shared('cancel')}
        tone="danger"
        open={asking}
        onOpenChange={setAsking}
        onConfirm={async () => {
          await change.confirm({ action: 'logout', id: detail.id })
          toast.success(t('ended'))
        }}
      />
    </Panel>
  )
}
