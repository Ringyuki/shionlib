import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/shionui/Drawer'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { useTranslations } from 'next-intl'
import { FavoriteContent } from './Content'
import { FavoriteCreate } from '../create/Create'

interface FavoriteActionDrawerProps {
  favorites: Favorite[]
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onFavoriteCreate: (favorite: Favorite) => void
}

export const FavoriteActionDrawer = ({
  favorites,
  game_id,
  open,
  onOpenChange,
  onFavoriteCreate,
}: FavoriteActionDrawerProps) => {
  const t = useTranslations('Components.Favorite.Action')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{t('description')}</DrawerDescription>
        </DrawerHeader>
        <FavoriteContent
          favorites={favorites}
          game_id={game_id}
          className="px-4 pb-4 overflow-y-auto"
        />
        <DrawerFooter>
          <FavoriteCreate onSuccess={onFavoriteCreate} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
