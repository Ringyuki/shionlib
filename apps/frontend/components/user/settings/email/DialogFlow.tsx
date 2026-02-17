import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { EmailFlow } from '@/components/user/settings/email/EmailFlow'
import { useTranslations } from 'next-intl'

interface DialogFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
  onSubmit: (data: {
    currentCode: string
    newEmail: string
    newEmailCodeUuid: string
    newEmailCode: string
  }) => void
  isSubmitting: boolean
}

export const DialogFlow = ({
  open,
  onOpenChange,
  currentEmail,
  onSubmit,
  isSubmitting,
}: DialogFlowProps) => {
  const t = useTranslations('Components.User.Settings.EmailFlow')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} fitContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EmailFlow currentEmail={currentEmail} onSubmit={onSubmit} isSubmitting={isSubmitting} />
      </DialogContent>
    </Dialog>
  )
}
