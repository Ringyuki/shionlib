import { FavoriteContent } from '@/components/user/home/favorites/FavoriteContent'
import { FavoriteItemsHeader } from '@/components/user/home/favorites/FavoriteItemsHeader'
import { Empty } from '@/components/common/content/Empty'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { FavoriteItem } from '@/interfaces/favorite/favorite-item.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Pagination } from '@/components/common/content/Pagination'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { UserProfile } from '@/interfaces/user/user.interface'

interface UserFavoritesPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; folder?: string }>
}

const getFavorites = async (userId: string) => {
  const data = await shionlibRequest().get<Favorite[]>('/favorites', {
    params: {
      user_id: userId,
    },
  })
  return data
}

async function getCurrentUser() {
  const data = await shionlibRequest({ forceNotThrowError: true }).get<UserProfile>(`/user/me`)
  return data.data
}

const getFavoriteItems = async (favoriteId: number, searchParams: { page?: string }) => {
  const data = await shionlibRequest().get<
    PaginatedResponse<FavoriteItem, { content_limit?: ContentLimit }>
  >(`/favorites/${favoriteId}/items`, {
    params: {
      page: searchParams.page ?? '1',
    },
  })
  return data
}

export default async function UserFavoritesPage({ params, searchParams }: UserFavoritesPageProps) {
  const { id } = await params
  const { page, folder } = await searchParams
  const [favoritesData, currentUser] = await Promise.all([getFavorites(id), getCurrentUser()])
  const { data: favorites } = favoritesData

  if (!favorites?.length) return <Empty />

  const parsedFolderId = folder ? Number(folder) : NaN
  const selectedFavorite =
    favorites.find(favorite => favorite.id === parsedFolderId) ||
    favorites.find(favorite => favorite.default) ||
    favorites[0]

  const itemsData = await getFavoriteItems(selectedFavorite.id, { page })
  return (
    <div className="flex flex-col gap-6">
      <FavoriteItemsHeader favorite={selectedFavorite} currentUser={currentUser} userId={id} />
      {itemsData.data?.items?.length ? (
        <>
          <FavoriteContent
            favorites={itemsData.data?.items ?? []}
            content_limit={itemsData.data?.meta?.content_limit}
          />
          <Pagination
            className="mt-4"
            currentPage={itemsData.data?.meta?.currentPage ?? 1}
            totalPages={itemsData.data?.meta?.totalPages ?? 1}
            extraQuery={{ folder: selectedFavorite.id }}
          />
        </>
      ) : (
        <Empty />
      )}
    </div>
  )
}
