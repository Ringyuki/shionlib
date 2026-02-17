import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { useState } from 'react'
import { Button } from '@/components/shionui/Button'
import { FolderCheck, Folder, CheckCircle2, Lock } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { shionlibRequest } from '@/utils/request'
import { useTranslations } from 'next-intl'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'

interface FavoriteContentItemProps {
  game_id: number
  favorite: Favorite
}

export const FavoriteContentItem = ({ game_id, favorite }: FavoriteContentItemProps) => {
  const t = useTranslations('Components.Favorite.Action.Content.Item')
  const [isFavorite, setIsFavorite] = useState(favorite.is_favorite)
  const [gameCount, setGameCount] = useState(favorite.game_count)
  const [loading, setLoading] = useState(false)

  const handleAddToFavorite = async () => {
    try {
      setLoading(true)
      await shionlibRequest().put(`/favorites/${favorite.id}`, {
        data: {
          game_id,
        },
      })
      setIsFavorite(true)
      setGameCount(gameCount + 1)
      // toast.success(t('added'))
      sileo.success({ title: t('added') })
    } catch {
    } finally {
      setLoading(false)
    }
  }
  const handleRemoveFromFavorite = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/favorites/${favorite.id}/games/${game_id}`)
      setIsFavorite(false)
      setGameCount(gameCount - 1)
      // toast.success(t('removed'))
      sileo.success({ title: t('removed') })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={isFavorite ? handleRemoveFromFavorite : handleAddToFavorite}
      loading={loading}
      appearance={isFavorite ? 'solid' : 'outline'}
      intent={isFavorite ? 'primary' : 'neutral'}
      innerClassName="w-full"
      className="h-10"
      renderIcon={isFavorite ? <FolderCheck className="size-5" /> : <Folder className="size-5" />}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="flex items-center gap-0.5 ml-1">
          {favorite.default ? t('default') : favorite.name}
          {favorite.is_private && <Lock className="size-3 mt-0.25" />}
        </span>
        <div className="flex items-center gap-2">
          {isFavorite && (
            <Badge variant="success" className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              {t('favorited')}
            </Badge>
          )}
          <Badge variant="default">{t('gameCount', { count: gameCount })}</Badge>
        </div>
      </div>
    </Button>
  )
}
