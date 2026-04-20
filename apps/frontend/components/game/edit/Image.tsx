'use client'

import { GameImage } from '@/interfaces/game/game.interface'
import { Edit } from './image/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { Create } from './image/create/Create'
import { shionlibRequest } from '@/utils/request'
import { FieldSyncButton } from './sync/FieldSyncButton'

interface ImageProps {
  images: GameImage[]
  id: number
}

export const Image = ({ images: initialImages, id }: ImageProps) => {
  const [images, setImages] = useState(initialImages)
  const { gamePermissions: permissions } = useEditPermissionStore()
  const t = useTranslations('Components.Game.Edit.Image')

  const handleSuccess = (data: GameImage, id?: number) => {
    if (id) setImages(prev => prev.map(prev => (prev.id === id ? { ...data, id } : prev)))
    else setImages(prev => [...prev, { ...data, id: prev.length + 1 }])
  }
  const handleDelete = (id: number) => {
    setImages(prev => prev.filter(image => image.id !== id))
  }
  const fetchImages = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<GameImage[]>(`/edit/game/${id}/image`)
      setImages(res.data || [])
    } catch {}
  }, [id])

  if (!permissions?.relationFields.includes('MANAGE_IMAGES')) {
    return <Empty title={t('noPermission')} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map(image => (
          <Edit key={image.url} image={image} onSuccess={handleSuccess} onDelete={handleDelete} />
        ))}
      </div>
      <FieldSyncButton gameId={id} field="images" onApplied={fetchImages} />
      <Create onSuccess={handleSuccess} />
    </div>
  )
}
