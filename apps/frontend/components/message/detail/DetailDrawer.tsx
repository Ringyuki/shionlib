import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { DetailContent } from './DetailContent'

interface DetailDrawerProps {
  messageId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead?: (id: number) => void
}

export const DetailDrawer = ({ messageId, open, onOpenChange, onRead }: DetailDrawerProps) => {
  const t = useTranslations('Components.Message.Detail.DetailDrawer')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-h-[50vh]" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <DetailContent messageId={messageId} open={open} onRead={onRead} className="px-4 pb-4" />
      </DrawerContent>
    </Drawer>
  )
}
