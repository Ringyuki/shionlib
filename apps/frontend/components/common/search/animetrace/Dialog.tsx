import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/shionui/Dialog'
import { AnimeTraceSearch } from './Search'
import { useTranslations } from 'next-intl'

interface AnimeTraceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AnimeTraceDialog = ({ open, onOpenChange }: AnimeTraceDialogProps) => {
  const t = useTranslations('Components.Common.Search.AnimeTrace.Dialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="lg:max-w-2xl!">
        <DialogHeader>
          <DialogTitle className="text-center">{t('title')}</DialogTitle>
          <DialogDescription className="text-center">{t('description')}</DialogDescription>
        </DialogHeader>
        <AnimeTraceSearch />
      </DialogContent>
    </Dialog>
  )
}
