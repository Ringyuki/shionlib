import { Favorite as FavoriteComponent } from '@/components/favorite/action/Favorite'

interface FavoriteProps {
  isFavorite: boolean
  gameId: number
  className?: string
}

export const Favorite = ({ isFavorite, gameId, className }: FavoriteProps) => {
  return <FavoriteComponent isFavorite={isFavorite} gameId={gameId} className={className} />
}
