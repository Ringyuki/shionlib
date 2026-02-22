import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { BindForm, BindFormValues } from './BindForm'

interface BindDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: BindFormValues) => void
  isSubmitting: boolean
}

export const BindDrawer = ({ open, onOpenChange, onSubmit, isSubmitting }: BindDrawerProps) => {
  const t = useTranslations('Components.User.Settings.Connections.PotatoVN.BindModal')

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <BindForm
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          className="px-4 pb-6"
        />
      </DrawerContent>
    </Drawer>
  )
}
