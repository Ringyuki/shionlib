'use client'

import { Edit } from './Edit'
import { History } from './History'

interface CharacterActionsProps {
  character_id: number
  character_h_id?: number
}

export const CharacterActions = ({ character_id, character_h_id }: CharacterActionsProps) => {
  return (
    <div className="flex gap-2">
      <Edit character_id={character_id} character_h_id={character_h_id} />
      <History character_id={character_id} />
    </div>
  )
}
