import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { Badge } from '@/components/shionui/Badge'
import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FavoriteAction } from './action/Action'
import { UserProfile } from '@/interfaces/user/user.interface'

interface FavoriteItemsHeaderProps {
  favorite: Favorite
  currentUser: UserProfile | null
  userId: string
}

export const FavoriteItemsHeader = ({
  favorite,
  currentUser,
  userId,
}: FavoriteItemsHeaderProps) => {
  const t = useTranslations('Components.User.Home.Favorites.FavoriteItemsHeader')
  return (
    <div className="sticky top-30 md:top-39.5 rounded-md px-4 py-2 shadow-card z-10 flex items-center justify-between border dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5]">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {favorite.default ? t('default') : favorite.name}
          </h2>
          {favorite.is_private && (
            <Badge variant="neutral" size="sm" className="gap-1">
              <Lock className="size-3" />
              {t('private')}
            </Badge>
          )}
          <Badge variant="default" size="sm">
            {favorite.game_count}
          </Badge>
        </div>
        {favorite.description ? (
          <p className="text-sm text-muted-foreground">{favorite.description}</p>
        ) : null}
      </div>
      {currentUser?.id === Number(userId) && <FavoriteAction favorite={favorite} />}
    </div>
  )
}
