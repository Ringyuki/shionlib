import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { useTranslations } from 'next-intl'
import { BindForm, BindFormValues } from './BindForm'

interface BindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: BindFormValues) => void
  isSubmitting: boolean
}

export const BindDialog = ({ open, onOpenChange, onSubmit, isSubmitting }: BindDialogProps) => {
  const t = useTranslations('Components.User.Settings.Connections.PotatoVN.BindModal')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} fitContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <BindForm
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  )
}
