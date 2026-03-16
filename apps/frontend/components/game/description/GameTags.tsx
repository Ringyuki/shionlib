import { Badge } from '@/components/shionui/Badge'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation.client'
import { GameTagRelation } from '@/interfaces/game/game.interface'

interface GameTagsProps {
  tags: GameTagRelation[]
}

export const GameTags = ({ tags }: GameTagsProps) => {
  const t = useTranslations('Components.Game.Description.GameTags')

  const getIntent = (count: number) => {
    if (count >= 100) return 'warning'
    if (count >= 10) return 'success'
    return 'neutral'
  }
  return (
    tags.length > 0 && (
      <>
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          <span>{t('tags')}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((relation, index) => {
            const name = relation.tag_alias ?? relation.tag.name
            return (
              <Link
                href={`/search/game?tag=${encodeURIComponent(relation.tag.name)}`}
                key={index}
                className="hover:opacity-80 transition-all duration-200"
              >
                <Badge
                  intent={getIntent(relation.tag.count)}
                  appearance="soft"
                  className="select-none"
                >
                  {name}
                </Badge>
              </Link>
            )
          })}
        </div>
      </>
    )
  )
}
