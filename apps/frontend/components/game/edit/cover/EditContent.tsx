import { GameCover } from '@/interfaces/game/game.interface'
import { z } from 'zod'
import { gameCoverSchemaType } from './Form'
import { CoverForm } from './Form'
import { Delete } from './delete/Delete'

interface EditContentProps {
  cover: GameCover
  onSubmit: (data: z.infer<typeof gameCoverSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditContent = ({ cover, onSubmit, isSubmitting, onDelete }: EditContentProps) => (
  <div className="flex flex-col gap-2">
    <CoverForm cover={cover} onSubmit={onSubmit} loading={isSubmitting} />
    <Delete id={cover.id!} onSuccess={onDelete} />
  </div>
)
