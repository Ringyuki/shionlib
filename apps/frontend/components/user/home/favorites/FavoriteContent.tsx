import { FavoriteItem } from '@/interfaces/favorite/favorite-item.interface'
import { FavoriteItem as FavoriteItemComponent } from './FavoriteItem'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface FavoriteContentProps {
  favorites: FavoriteItem[]
  content_limit?: ContentLimit
}

export const FavoriteContent = ({ favorites, content_limit }: FavoriteContentProps) => {
  return (
    <div className="flex flex-col gap-6">
      {favorites.map(favorite => (
        <FavoriteItemComponent
          key={favorite.id}
          favorite={favorite}
          content_limit={content_limit}
        />
      ))}
    </div>
  )
}
