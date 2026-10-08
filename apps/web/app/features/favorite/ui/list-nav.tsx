import { Inline, NavLink, Select, Stack, Text } from '@hina-ui/react'
import { Lock, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { InPageLink, keepScroll } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { favoritesPath, listLabel, type FavoriteList } from '../favorite'

type ListNavProps = {
  owner: number
  lists: readonly FavoriteList[]
  selected: FavoriteList
  onCreate?: () => void
}

export function ListNav({ owner, lists, selected, onCreate }: ListNavProps) {
  const t = useTranslations('favorite')
  const locale = useLocale()
  const format = useFormatter()
  const navigate = useNavigate()
  const label = (list: FavoriteList) => listLabel(list, t('defaultList'))
  return (
    <Stack gap="sm">
      <Select
        aria-label={t('lists')}
        value={selected.id}
        onValueChange={value => {
          const chosen = lists.find(list => list.id === value)
          if (chosen !== undefined) {
            void navigate(favoritesPath(locale, owner, chosen.id), { state: keepScroll })
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
            href={favoritesPath(locale, owner, list.id)}
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
      {onCreate !== undefined && (
        <Button
          variant="ghost"
          tone="neutral"
          icon={<Plus />}
          onClick={onCreate}
          className="justify-start"
        >
          {t('newList')}
        </Button>
      )}
    </Stack>
  )
}
