import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { FavoriteCreateContent } from './Content'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

interface FavoriteCreateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteCreateDrawer = ({
  open,
  onOpenChange,
  onSuccess,
}: FavoriteCreateDrawerProps) => {
  const t = useTranslations('Components.Favorite.Create')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>
        <FavoriteCreateContent onSuccess={onSuccess} className="px-4 pb-4" />
      </DrawerContent>
    </Drawer>
  )
}
