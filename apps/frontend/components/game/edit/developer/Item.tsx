'use client'

import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Badge } from '@/components/shionui/Badge'
import { Building2 } from 'lucide-react'

interface DeveloperRelationItemProps {
  relation: DeveloperRelation
  onClick?: () => void
}

export const DeveloperRelationItem = ({ relation, onClick }: DeveloperRelationItemProps) => {
  return (
    <div className="relative flex flex-col gap-1 cursor-pointer group" onClick={onClick}>
      <div
        className="relative rounded-md overflow-hidden bg-muted w-full group-hover:opacity-80 transition-opacity flex items-center justify-center"
        style={{ aspectRatio: '1 / 1' }}
      >
        {relation.developer.logo ? (
          <FadeImage
            src={relation.developer.logo}
            alt={relation.developer.name}
            imageClassName="object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="size-10 text-muted-foreground" />
          </div>
        )}
        {relation.role && (
          <Badge variant="secondary" className="absolute top-1 right-1 text-xs">
            {relation.role}
          </Badge>
        )}
      </div>
      <span className="text-sm font-medium truncate text-center">{relation.developer.name}</span>
    </div>
  )
}
