import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/shionui/Dialog'
import { useTranslations } from 'next-intl'
import { FavoriteEditContent } from './Content'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

interface FavoriteEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (favorite: Favorite) => void
  favorite: Favorite
}

export const FavoriteEditDialog = ({
  open,
  onOpenChange,
  onSuccess,
  favorite,
}: FavoriteEditDialogProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Edit')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <FavoriteEditContent favorite={favorite} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  )
}
