'use client'

import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { FavoriteDelete } from './delete/Delete'
import { FavoriteEdit } from './edit/Edit'
import { useRouter } from 'next/navigation'

interface FavoriteActionProps {
  favorite: Favorite
}

export const FavoriteAction = ({ favorite }: FavoriteActionProps) => {
  const router = useRouter()

  const handleDelete = () => {
    router.refresh()
    window.location.reload()
  }
  const handleEdit = () => {
    router.refresh()
  }
  return (
    <div className="flex gap-2">
      <FavoriteEdit favorite={favorite} onSuccess={handleEdit} />
      <FavoriteDelete id={favorite.id} onSuccess={handleDelete} />
    </div>
  )
}
