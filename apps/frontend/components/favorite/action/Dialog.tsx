import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/shionui/Dialog'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { useTranslations } from 'next-intl'
import { FavoriteContent } from './Content'
import { FavoriteCreate } from '../create/Create'

interface FavoriteActionDialogProps {
  favorites: Favorite[]
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onFavoriteCreate: (favorite: Favorite) => void
}

export const FavoriteActionDialog = ({
  favorites,
  game_id,
  open,
  onOpenChange,
  onFavoriteCreate,
}: FavoriteActionDialogProps) => {
  const t = useTranslations('Components.Favorite.Action')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <FavoriteContent favorites={favorites} game_id={game_id} />
        <DialogFooter>
          <FavoriteCreate onSuccess={onFavoriteCreate} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
