'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { GameCharacterRelation, GameCharacterRole } from '@/interfaces/game/game.interface'
import { SearchCharacter } from './character/Search'
import { Edit } from './character/Edit'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'

interface CharacterEditProps {
  initRelations: GameCharacterRelation[]
  id: number
}

export const Character = ({ initRelations, id }: CharacterEditProps) => {
  const t = useTranslations('Components.Game.Edit.Character')
  const [relations, setRelations] = useState(initRelations)

  const fetchRelations = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<GameCharacterRelation[]>(
        `/edit/game/${id}/characters`,
      )
      setRelations(res.data || [])
    } catch {}
  }, [id])

  const { gamePermissions: permissions } = useEditPermissionStore()
  if (!permissions?.relationFields.includes('MANAGE_CHARACTERS')) {
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
  const handleImageUpdate = (relationId: number, imageKey: string) => {
    setRelations(
      relations.map(relation =>
        relation.id === relationId ? { ...relation, image: imageKey } : relation,
      ),
    )
  }

  const priority: Record<GameCharacterRole, number> = {
    main: 0,
    primary: 1,
    side: 2,
    appears: 3,
  }
  const sorted = [...relations].sort((a, b) => {
    const aPriority = a.role ? priority[a.role] : 4
    const bPriority = b.role ? priority[b.role] : 4
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.character.id - b.character.id
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {sorted.map(relation => (
          <Edit
            key={relation.id}
            relation={relation}
            game_id={id}
            onDelete={handleDelete}
            onImageUpdate={handleImageUpdate}
          />
        ))}
      </div>
      {sorted.length === 0 && <Empty title={t('Item.no_characters')} />}
      <SearchCharacter relations={relations} onAdd={handleAdd} game_id={id} />
    </div>
  )
}
