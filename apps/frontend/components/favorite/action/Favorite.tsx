import { Heart } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/shionui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { shionlibRequest } from '@/utils/request'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Favorite as FavoriteInterface } from '@/interfaces/favorite/favorite.interface'
import { FavoriteActionDialog } from './Dialog'
import { FavoriteActionDrawer } from './Drawer'
import { useMedia } from 'react-use'

interface FavoriteProps {
  isFavorite: boolean
  gameId: number
  className?: string
}

export const Favorite = ({ isFavorite, gameId, className }: FavoriteProps) => {
  const t = useTranslations('Components.Favorite.Action')
  const [loading, setLoading] = useState(false)
  const [favorites, setFavorites] = useState<FavoriteInterface[]>([])
  const [open, setOpen] = useState(false)
  const isMobile = useMedia('(max-width: 768px)', false)

  const getData = async () => {
    try {
      setLoading(true)
      const { data } = await shionlibRequest().get<FavoriteInterface[]>('/favorites', {
        params: {
          game_id: gameId,
        },
      })
      setFavorites(data ?? [])
      setOpen(true)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleFavoriteCreate = (favorite: FavoriteInterface) =>
    setFavorites(prev => [...prev, favorite])
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          <Button
            size="icon"
            intent="destructive"
            appearance="ghost"
            onClick={getData}
            loading={loading}
            loginRequired
            renderIcon={() => <Heart className={cn(isFavorite && 'fill-destructive')} />}
          />
        </TooltipTrigger>
        <TooltipContent>
          <span>{isFavorite ? t('removeFromFavorites') : t('addToFavorites')}</span>
        </TooltipContent>
      </Tooltip>
      {isMobile ? (
        <FavoriteActionDrawer
          favorites={favorites}
          game_id={gameId}
          open={open}
          onOpenChange={setOpen}
          onFavoriteCreate={handleFavoriteCreate}
        />
      ) : (
        <FavoriteActionDialog
          favorites={favorites}
          game_id={gameId}
          open={open}
          onOpenChange={setOpen}
          onFavoriteCreate={handleFavoriteCreate}
        />
      )}
    </>
  )
}
