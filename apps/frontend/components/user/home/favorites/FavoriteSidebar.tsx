'use client'

import { useMemo, useState } from 'react'
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { FavoriteList } from './FavoriteList'
import { UserProfile } from '@/interfaces/user/user.interface'

interface FavoriteSidebarProps {
  userId: string
  favorites: Favorite[]
  currentUser: UserProfile | null
}

export const FavoriteSidebar = ({ userId, currentUser, favorites }: FavoriteSidebarProps) => {
  const segment = useSelectedLayoutSegment()
  const searchParams = useSearchParams()
  const [favoritesList, setFavoritesList] = useState(favorites)

  const selectedId = useMemo(() => {
    if (!favoritesList?.length) return undefined
    const folder = searchParams.get('folder')
    const parsedFolderId = folder ? Number(folder) : NaN
    return (
      favoritesList.find(favorite => favorite.id === parsedFolderId)?.id ||
      favoritesList.find(favorite => favorite.default)?.id ||
      favoritesList[0]?.id
    )
  }, [favoritesList, searchParams])

  const sortedFavorites = useMemo(() => {
    return [...favoritesList].sort((a, b) => Number(b.default) - Number(a.default))
  }, [favoritesList])

  if (segment !== 'favorites') return null

  const handleCreateSuccess = (favorite: Favorite) => {
    setFavoritesList(prev => [...prev, favorite])
  }

  return (
    <FavoriteList
      favorites={sortedFavorites}
      selectedId={selectedId}
      userId={userId}
      currentUser={currentUser}
      onCreateSuccess={handleCreateSuccess}
    />
  )
}
