import { Chip, Inline, Section } from '@hina-ui/react'
import { Hash } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { tagPath, type GameDetails } from '../game'

export function GameTags({ tags }: { tags: NonNullable<GameDetails['tags']> }) {
  const t = useTranslations('game.info')
  const locale = useLocale()
  return (
    <Section title={t('tags')}>
      <Inline gap="xs">
        {tags.map(link => (
          <Chip key={link.tag.id} asChild className="gap-1">
            <Link to={tagPath(locale, link.tag.name)}>
              <Hash aria-hidden />
              {link.tag_alias ?? link.tag.name}
            </Link>
          </Chip>
        ))}
      </Inline>
    </Section>
  )
}
