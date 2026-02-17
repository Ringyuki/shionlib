'use client'

import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Badge } from '@/components/shionui/Badge'
import { User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { roleBadgeColorMap } from '@/components/game/description/helpers/roleBadgeColorMap'
import { cn } from '@/utils/cn'

interface CharacterRelationItemProps {
  relation: GameCharacterRelation
  onClick?: () => void
}

export const CharacterRelationItem = ({ relation, onClick }: CharacterRelationItemProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Item')

  const imageUrl = relation.image || relation.character.image
  const name =
    relation.character.name_jp ||
    relation.character.name_zh ||
    relation.character.name_en ||
    'Unknown'

  return (
    <div className="relative flex flex-col gap-1 cursor-pointer group" onClick={onClick}>
      <div
        className="relative rounded-md overflow-hidden bg-muted w-full group-hover:opacity-80 transition-opacity"
        style={{ aspectRatio: '3 / 4' }}
      >
        {imageUrl ? (
          <FadeImage src={imageUrl} alt={name} imageClassName="object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="size-10 text-muted-foreground" />
          </div>
        )}
        {relation.role && (
          <Badge className={cn(roleBadgeColorMap[relation.role], 'absolute top-1 right-1 text-xs')}>
            {t(`role_${relation.role}`)}
          </Badge>
        )}
      </div>
      <span className="text-sm font-medium truncate text-center">{name}</span>
      {relation.actor && (
        <span className="text-xs text-muted-foreground truncate text-center">
          CV: {relation.actor}
        </span>
      )}
    </div>
  )
}
