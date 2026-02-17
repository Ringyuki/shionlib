import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { FavoriteEditContent } from './Content'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

interface FavoriteEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (favorite: Favorite) => void
  favorite: Favorite
}

export const FavoriteEditDrawer = ({
  open,
  onOpenChange,
  onSuccess,
  favorite,
}: FavoriteEditDrawerProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Edit')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>
        <FavoriteEditContent favorite={favorite} onSuccess={onSuccess} className="px-4 pb-4" />
      </DrawerContent>
    </Drawer>
  )
}
