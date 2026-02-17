'use client'

import { GameCover } from '@/interfaces/game/game.interface'
import { Edit } from './cover/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Create } from './cover/create/Create'

interface CoverProps {
  covers: GameCover[]
}

export const Cover = ({ covers: initialCovers }: CoverProps) => {
  const [covers, setCovers] = useState(initialCovers)
  const { gamePermissions: permissions } = useEditPermissionStore()
  const t = useTranslations('Components.Game.Edit.Cover')
  if (!permissions?.relationFields.includes('MANAGE_COVERS')) {
    return <Empty title={t('noPermission')} />
  }

  const handleSuccess = (data: GameCover, id?: number) => {
    if (id) setCovers(prev => prev.map(prev => (prev.id === id ? { ...data, id } : prev)))
    else setCovers(prev => [...prev, { ...data, id: prev.length + 1 }])
  }
  const handleDelete = (id: number) => {
    setCovers(prev => prev.filter(cover => cover.id !== id))
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {covers.map(cover => (
          <Edit key={cover.url} cover={cover} onSuccess={handleSuccess} onDelete={handleDelete} />
        ))}
      </div>
      <Create onSuccess={handleSuccess} />
    </div>
  )
}
