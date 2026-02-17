import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { EmailFlow } from '@/components/user/settings/email/EmailFlow'
import { useTranslations } from 'next-intl'

interface DrawerFlowProps {
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

export const DrawerFlow = ({
  open,
  onOpenChange,
  currentEmail,
  onSubmit,
  isSubmitting,
}: DrawerFlowProps) => {
  const t = useTranslations('Components.User.Settings.EmailFlow')
  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <EmailFlow
          currentEmail={currentEmail}
          className="overflow-auto px-4 pb-4 h-[80vh]"
          variant="vertical"
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </DrawerContent>
    </Drawer>
  )
}
