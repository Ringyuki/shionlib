import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { FavoriteContentItem } from './content/Item'
import { cn } from '@/utils/cn'

interface FavoriteContentProps {
  favorites: Favorite[]
  game_id: number
  className?: string
}

export const FavoriteContent = ({ favorites, game_id, className }: FavoriteContentProps) => {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {favorites.map(favorite => (
        <FavoriteContentItem key={favorite.id} game_id={game_id} favorite={favorite} />
      ))}
    </div>
  )
}
