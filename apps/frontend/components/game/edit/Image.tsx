'use client'

import { GameImage } from '@/interfaces/game/game.interface'
import { Edit } from './image/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Create } from './image/create/Create'

interface ImageProps {
  images: GameImage[]
}

export const Image = ({ images: initialImages }: ImageProps) => {
  const [images, setImages] = useState(initialImages)
  const { gamePermissions: permissions } = useEditPermissionStore()
  const t = useTranslations('Components.Game.Edit.Image')
  if (!permissions?.relationFields.includes('MANAGE_IMAGES')) {
    return <Empty title={t('noPermission')} />
  }

  const handleSuccess = (data: GameImage, id?: number) => {
    if (id) setImages(prev => prev.map(prev => (prev.id === id ? { ...data, id } : prev)))
    else setImages(prev => [...prev, { ...data, id: prev.length + 1 }])
  }
  const handleDelete = (id: number) => {
    setImages(prev => prev.filter(image => image.id !== id))
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map(image => (
          <Edit key={image.url} image={image} onSuccess={handleSuccess} onDelete={handleDelete} />
        ))}
      </div>
      <Create onSuccess={handleSuccess} />
    </div>
  )
}
