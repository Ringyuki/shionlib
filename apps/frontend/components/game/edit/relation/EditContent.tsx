'use client'

import { GameRelation } from '@/interfaces/game/game.interface'
import { z } from 'zod'
import { relationSchemaType, RelationForm } from './Form'
import { Delete } from './delete/Delete'
import { Link } from '@/i18n/navigation.client'
import { Button } from '@/components/shionui/Button'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EditContentProps {
  relation: GameRelation
  game_id: number
  onSubmit: (data: z.infer<typeof relationSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditContent = ({
  relation,
  game_id,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditContentProps) => {
  const t = useTranslations('Components.Game.Edit.Relation.Edit')
  const title = relation.to_game.title_zh || relation.to_game.title_jp || relation.to_game.title_en

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{title}</span>
        <Link href={`/game/${relation.to_game_id}`} target="_blank">
          <Button
            type="button"
            size="sm"
            appearance="ghost"
            renderIcon={<ExternalLink className="size-4" />}
          >
            {t('view_game')}
          </Button>
        </Link>
      </div>
      <RelationForm relation={relation} onSubmit={onSubmit} loading={isSubmitting} />
      <Delete id={relation.id} game_id={game_id} onSuccess={onDelete} />
    </div>
  )
}
