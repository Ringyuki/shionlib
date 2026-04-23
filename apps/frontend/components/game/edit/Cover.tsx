'use client'

import { GameCover } from '@/interfaces/game/game.interface'
import { Edit } from './cover/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { Create } from './cover/create/Create'
import { shionlibRequest } from '@/utils/request'
import { useFieldSyncApplied } from './sync/field-sync-events'

interface CoverProps {
  covers: GameCover[]
  id: number
}

export const Cover = ({ covers: initialCovers, id }: CoverProps) => {
  const [covers, setCovers] = useState(initialCovers)
  const { gamePermissions: permissions } = useEditPermissionStore()
  const t = useTranslations('Components.Game.Edit.Cover')

  const handleSuccess = (data: GameCover, id?: number) => {
    if (id) setCovers(prev => prev.map(prev => (prev.id === id ? { ...data, id } : prev)))
    else setCovers(prev => [...prev, { ...data, id: prev.length + 1 }])
  }
  const handleDelete = (id: number) => {
    setCovers(prev => prev.filter(cover => cover.id !== id))
  }
  const fetchCovers = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<GameCover[]>(`/edit/game/${id}/cover`)
      setCovers(res.data || [])
    } catch {}
  }, [id])
  useFieldSyncApplied('covers', fetchCovers)

  if (!permissions?.relationFields.includes('MANAGE_COVERS')) {
    return <Empty title={t('noPermission')} />
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
