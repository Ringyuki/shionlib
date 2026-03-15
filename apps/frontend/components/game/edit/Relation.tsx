'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { GameRelation, GameRelationType } from '@/interfaces/game/game.interface'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { Edit } from './relation/Edit'
import { SearchRelation } from './relation/Search'
import { z } from 'zod'
import { relationSchemaType } from './relation/Form'

interface RelationEditProps {
  initRelations: GameRelation[]
  id: number
}

export const Relation = ({ initRelations, id }: RelationEditProps) => {
  const t = useTranslations('Components.Game.Edit.Relation')
  const [relations, setRelations] = useState(initRelations)

  const fetchRelations = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<GameRelation[]>(`/edit/game/${id}/relations`)
      setRelations(res.data || [])
    } catch {}
  }, [id])

  const { gamePermissions: permissions } = useEditPermissionStore()
  if (!permissions?.relationFields.includes('MANAGE_RELATIONS')) {
    return <Empty title={t('noPermission')} />
  }

  const handleSuccess = (data: z.infer<typeof relationSchemaType>, relation: GameRelation) => {
    setRelations(prev =>
      prev.map(r =>
        r.id === relation.id ? { ...r, relation: data.relation as GameRelationType } : r,
      ),
    )
  }

  const handleDelete = async (relationId: number) => {
    setRelations(prev => prev.filter(r => r.id !== relationId))
    await fetchRelations()
  }

  const grouped = relations.reduce<Record<string, GameRelation[]>>((acc, r) => {
    if (!acc[r.relation]) acc[r.relation] = []
    acc[r.relation].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {relations.length === 0 && <Empty title={t('noRelations')} />}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t(`relationType.${type}`)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(rel => (
              <Edit
                key={rel.id}
                relation={rel}
                game_id={id}
                onSuccess={handleSuccess}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}
      <SearchRelation relations={relations} onAdd={fetchRelations} game_id={id} />
    </div>
  )
}
