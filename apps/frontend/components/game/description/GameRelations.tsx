'use client'

import { GameRelation } from '@/interfaces/game/game.interface'
import { GameEmbeddedCard } from '@/components/game/GameEmbeddedCard'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { useTranslations } from 'next-intl'

interface GameRelationsProps {
  relations: GameRelation[]
  content_limit?: ContentLimit
}

export const GameRelations = ({ relations, content_limit }: GameRelationsProps) => {
  const t = useTranslations('Components.Game.Description.GameRelations')

  const grouped = relations.reduce<Record<string, GameRelation[]>>((acc, r) => {
    if (!acc[r.relation]) acc[r.relation] = []
    acc[r.relation].push(r)
    return acc
  }, {})

  return (
    relations.length > 0 && (
      <>
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          <span>{t('title')}</span>
        </h2>
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t(`relationType.${type}`)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map(rel => (
                  <GameEmbeddedCard
                    key={rel.id}
                    game={rel.to_game as any}
                    content_limit={content_limit}
                    className="hover:border-inherit"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  )
}
