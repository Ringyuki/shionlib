'use client'

import { GameLink } from '@/interfaces/game/game.interface'
import { LinkFormValues, LinkForm } from './Form'
import { Delete } from './delete/Delete'

interface EditContentProps {
  link: GameLink
  game_id: number
  onSubmit: (data: LinkFormValues) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditContent = ({
  link,
  game_id,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditContentProps) => {
  return (
    <div className="flex flex-col gap-2">
      <LinkForm
        defaultValues={{ url: link.url, label: link.label, name: link.name }}
        onSubmit={onSubmit}
        loading={isSubmitting}
      />
      <Delete id={link.id} game_id={game_id} onSuccess={onDelete} />
    </div>
  )
}
