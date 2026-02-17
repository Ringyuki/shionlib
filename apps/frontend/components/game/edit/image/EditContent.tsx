import { GameImage } from '@/interfaces/game/game.interface'
import { z } from 'zod'
import { gameImageSchemaType } from './Form'
import { ImageForm } from './Form'
import { Delete } from './delete/Delete'

interface EditContentProps {
  image: GameImage
  onSubmit: (data: z.infer<typeof gameImageSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditContent = ({ image, onSubmit, isSubmitting, onDelete }: EditContentProps) => (
  <div className="flex flex-col gap-2">
    <ImageForm image={image} onSubmit={onSubmit} loading={isSubmitting} />
    <Delete id={image.id!} onSuccess={onDelete} />
  </div>
)
