import { AlertDialog, Inline, Text, toast } from '@hina-ui/react'
import { CircleOff, CirclePlay, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { BatchOperation } from '../admin-ai-route'
import { useRouteChange } from '../use-route-change'

type RouteBatchBarProps = {
  ids: number[]
  onDone: () => void
}

export function RouteBatchBar({ ids, onDone }: RouteBatchBarProps) {
  const t = useTranslations('adminAiRoute.batch')
  const shared = useTranslations('admin')
  const [confirming, setConfirming] = useState(false)
  const change = useRouteChange()
  const count = ids.length
  const apply = async (operation: BatchOperation) => {
    await change.confirm({ action: 'batch', ids, operation })
    onDone()
    toast.success(t(`done.${operation}`, { count }))
  }
  const tools = {
    size: 'sm',
    variant: 'outline',
    tone: 'neutral',
    disabled: change.pending,
  } as const
  return (
    <>
      <Text as="span" size="sm" weight="medium">
        {shared('selected', { count })}
      </Text>
      <Button {...tools} icon={<CirclePlay />} onClick={() => void apply('enable')}>
        {t('enable')}
      </Button>
      <Button {...tools} icon={<CircleOff />} onClick={() => void apply('disable')}>
        {t('disable')}
      </Button>
      <Button {...tools} tone="danger" icon={<Trash2 />} onClick={() => setConfirming(true)}>
        {t('delete')}
      </Button>
      <Inline className="ms-auto">
        <Button size="sm" variant="ghost" tone="neutral" disabled={change.pending} onClick={onDone}>
          {shared('clearSelection')}
        </Button>
      </Inline>
      <AlertDialog
        tone="danger"
        title={t('deleteTitle', { count })}
        description={t('deleteHint')}
        confirmText={t('delete')}
        cancelText={shared('cancel')}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => apply('delete')}
      />
    </>
  )
}
