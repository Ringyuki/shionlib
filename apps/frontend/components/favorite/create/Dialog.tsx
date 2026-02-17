import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/shionui/Dialog'
import { useTranslations } from 'next-intl'
import { FavoriteCreateContent } from './Content'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

interface FavoriteCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteCreateDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: FavoriteCreateDialogProps) => {
  const t = useTranslations('Components.Favorite.Create')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <FavoriteCreateContent onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  )
}
