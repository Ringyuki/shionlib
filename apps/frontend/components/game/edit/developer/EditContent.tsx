'use client'

import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { z } from 'zod'
import { developerRelationSchemaType, DeveloperRelationForm } from './Form'
import { Delete } from './delete/Delete'
import { Link } from '@/i18n/navigation.client'
import { Button } from '@/components/shionui/Button'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EditContentProps {
  relation: DeveloperRelation
  game_id: number
  onSubmit: (data: z.infer<typeof developerRelationSchemaType>) => void
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
  const t = useTranslations('Components.Game.Edit.Developer.Edit')
  const name = relation.developer.name

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{name}</span>
        <Link href={`/developer/${relation.developer.id}`} target="_blank">
          <Button
            type="button"
            size="sm"
            appearance="ghost"
            renderIcon={<ExternalLink className="size-4" />}
          >
            {t('view_developer')}
          </Button>
        </Link>
      </div>
      <DeveloperRelationForm relation={relation} onSubmit={onSubmit} loading={isSubmitting} />
      <Delete id={relation.id} game_id={game_id} onSuccess={onDelete} />
    </div>
  )
}
