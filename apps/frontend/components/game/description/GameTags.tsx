import { Badge } from '@/components/shionui/Badge'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation.client'

interface GameTagsProps {
  tags: string[]
}

export const GameTags = ({ tags }: GameTagsProps) => {
  const t = useTranslations('Components.Game.Description.GameTags')

  const groupIntents = ['warning', 'success', 'secondary'] as const
  const getIntent = (index: number) =>
    groupIntents[Math.min(Math.floor(index / 10), groupIntents.length - 1)]
  return (
    tags.length > 0 && (
      <>
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          <span>{t('tags')}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <Link
              href={`/search/game?q=${tag}`}
              key={index}
              className="hover:opacity-80 transition-all duration-200"
            >
              <Badge intent={getIntent(index)} appearance="soft" className="select-none">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>
      </>
    )
  )
}
