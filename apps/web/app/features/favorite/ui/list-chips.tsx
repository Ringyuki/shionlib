import { Chip, Inline, Text } from '@hina-ui/react'
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { favoritesPath, listLabel, type FavoriteList } from '../favorite'

type ListChipsProps = {
  owner: number
  lists: readonly FavoriteList[]
  selected: FavoriteList
  actions: ReactNode
}

export function ListChips({ owner, lists, selected, actions }: ListChipsProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  return (
    <Inline gap="sm" align="start" justify="between" wrap={false}>
      <Inline as="nav" gap="sm" aria-label={t('lists')} className="min-w-0">
        {lists.map(list => {
          const current = list.id === selected.id
          return (
            <Chip
              key={list.id}
              as={InPageLink}
              href={favoritesPath(locale, owner, list.id)}
              variant={current ? 'soft' : 'outline'}
              tone={current ? 'accent' : 'neutral'}
              aria-current={current ? 'page' : undefined}
              icon={list.is_private ? <Lock aria-label={t('private')} /> : undefined}
            >
              {listLabel(list, t('defaultList'))}
              <Text as="span" size="sm" className="ms-2 font-normal tabular-nums opacity-80">
                {format.number(list.game_count)}
              </Text>
            </Chip>
          )
        })}
      </Inline>
      {actions}
    </Inline>
  )
}
