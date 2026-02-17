'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { SearchDeveloper } from './developer/Search'
import { Edit } from './developer/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'

interface DeveloperEditProps {
  initRelations: DeveloperRelation[]
  id: number
}

export const Developer = ({ initRelations, id }: DeveloperEditProps) => {
  const t = useTranslations('Components.Game.Edit.Developer')
  const [relations, setRelations] = useState(initRelations)

  const fetchRelations = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<DeveloperRelation[]>(`/edit/game/${id}/developers`)
      setRelations(res.data || [])
    } catch {}
  }, [id])

  const { gamePermissions: permissions } = useEditPermissionStore()
  if (!permissions?.relationFields.includes('MANAGE_DEVELOPERS')) {
    return <Empty title={t('noPermission')} />
  }

  const handleAdd = async () => {
    // toast.success(t('added'))
    sileo.success({ title: t('added') })
    await fetchRelations()
  }

  const handleDelete = async (relationId: number) => {
    setRelations(relations.filter(relation => relation.id !== relationId))
    await fetchRelations()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {relations.map(relation => (
          <Edit key={relation.id} relation={relation} game_id={id} onDelete={handleDelete} />
        ))}
      </div>
      {relations.length === 0 && <Empty title={t('Item.no_developers')} />}
      <SearchDeveloper relations={relations} onAdd={handleAdd} game_id={id} />
    </div>
  )
}
