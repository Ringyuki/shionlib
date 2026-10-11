import { Inline, NavLink, Select, Stack, Text } from '@hina-ui/react'
import { Lock } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { favoritesPath, listLabel, type FavoriteList } from '../favorite'

type ListNavProps = {
  lists: readonly FavoriteList[]
  selected: FavoriteList
}

export function ListNav({ lists, selected }: ListNavProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  const stay = useInPageNavigate()
  const label = (list: FavoriteList) => listLabel(list, t('defaultList'))
  return (
    <>
      <Select
        aria-label={t('lists')}
        value={selected.id}
        onValueChange={value => {
          const chosen = lists.find(list => list.id === value)
          if (chosen !== undefined) {
            stay(favoritesPath(locale, chosen.id))
          }
        }}
        options={lists.map(list => ({ value: list.id, label: label(list) }))}
        className="lg:hidden"
      />
      <Stack as="nav" gap="xs" aria-label={t('lists')} className="max-lg:hidden">
        {lists.map(list => (
          <NavLink
            key={list.id}
            as={InPageLink}
            href={favoritesPath(locale, list.id)}
            active={list.id === selected.id}
          >
            <Inline as="span" gap="sm" align="center" wrap={false}>
              {label(list)}
              {list.is_private && <Lock aria-label={t('private')} />}
              <Text as="span" size="sm" tone="faint" className="tabular-nums">
                {format.number(list.game_count)}
              </Text>
            </Inline>
          </NavLink>
        ))}
      </Stack>
    </>
  )
}
