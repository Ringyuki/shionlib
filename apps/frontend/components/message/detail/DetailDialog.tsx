import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { useTranslations } from 'next-intl'
import { DetailContent } from './DetailContent'

interface DetailDialogProps {
  messageId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead?: (id: number) => void
}

export const DetailDialog = ({ messageId, open, onOpenChange, onRead }: DetailDialogProps) => {
  const t = useTranslations('Components.Message.Detail.DetailDialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DetailContent messageId={messageId} open={open} onRead={onRead} className="px-0 pb-4" />
      </DialogContent>
    </Dialog>
  )
}
