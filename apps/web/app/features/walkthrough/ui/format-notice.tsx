import { Alert } from '@hina-ui/react'
import { Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

type FormatNoticeProps = {
  count: number
  open: boolean
  onUndo: () => void
  onDismiss: () => void
}

export function FormatNotice({ count, open, onUndo, onDismiss }: FormatNoticeProps) {
  const t = useTranslations('walkthrough.format')
  return (
    <Alert
      tone="info"
      closable
      open={open}
      onOpenChange={next => {
        if (!next) {
          onDismiss()
        }
      }}
      actions={
        <Button size="sm" variant="outline" icon={<Undo2 />} onClick={onUndo}>
          {t('undo')}
        </Button>
      }
    >
      {t('done', { count })}
    </Alert>
  )
}
