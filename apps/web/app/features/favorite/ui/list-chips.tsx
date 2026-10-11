import { Chip, Inline, Text } from '@hina-ui/react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { listLabel, showcasePath, type FavoriteList } from '../favorite'

type ListChipsProps = {
  owner: number
  lists: readonly FavoriteList[]
  selected: FavoriteList
}

export function ListChips({ owner, lists, selected }: ListChipsProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  return (
    <Inline as="nav" gap="sm" aria-label={t('lists')}>
      {lists.map(list => {
        const current = list.id === selected.id
        return (
          <Chip
            key={list.id}
            as={InPageLink}
            href={showcasePath(locale, owner, list.id)}
            variant={current ? 'soft' : 'outline'}
            tone={current ? 'accent' : 'neutral'}
            aria-current={current ? 'page' : undefined}
          >
            {listLabel(list, t('defaultList'))}
            <Text as="span" size="sm" className="ms-2 font-normal tabular-nums opacity-80">
              {format.number(list.game_count)}
            </Text>
          </Chip>
        )
      })}
    </Inline>
  )
}
