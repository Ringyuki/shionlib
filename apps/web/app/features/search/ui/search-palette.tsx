import {
  Button,
  CommandPalette,
  Kbd,
  Spinner,
  Text,
  type CommandItem,
  type CommandItems,
} from '@hina-ui/react'
import {
  ArrowRight,
  Building2,
  Gamepad2,
  History,
  Search,
  SearchX,
  Trash2,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { developerNames, gameTitle, originalTitle, releaseDate } from '~/features/game'
import { characterName, type Palette } from '../search'
import { useSearchPalette } from '../use-search-palette'

export type SearchShortcut = {
  id: string
  label: string
  to: string
  icon: CommandItem['icon']
}

type SearchPaletteProps = {
  shortcuts: readonly SearchShortcut[]
}

export function SearchPalette({ shortcuts }: SearchPaletteProps) {
  const t = useTranslations('search')
  const tGame = useTranslations('game')
  const locale = useLocale()
  const navigate = useNavigate()
  const palette = useSearchPalette()
  const { query } = palette

  const go = (to: string, settled = false) => {
    if (settled) {
      palette.settle()
    }
    void navigate(to)
  }

  const shortcutGroup = {
    label: t('groups.shortcuts'),
    items: shortcuts.map(shortcut => ({
      id: `go:${shortcut.id}`,
      label: shortcut.label,
      icon: shortcut.icon,
      onSelect: () => go(shortcut.to),
    })),
  }

  const status = (id: string, label: string, icon: CommandItem['icon']): CommandItems[number] => ({
    label: t('groups.status'),
    items: [{ id: `status:${id}`, label, icon, disabled: true }],
  })

  const resultGroups = (data: Palette): CommandItems => {
    if (data.unavailable) {
      return [status('unavailable', t('unavailable'), SearchX), shortcutGroup]
    }
    const results = data.results
    const games = results?.games.items ?? []
    const developers = results?.developers.items ?? []
    const characters = results?.characters.items ?? []
    const groups: CommandItems = []
    if (games.length > 0) {
      groups.push({
        label: t('groups.games'),
        items: [
          ...games.map(game => {
            const released = releaseDate(game)
            return {
              id: `game:${game.id}`,
              label: gameTitle(game, locale),
              description: [
                originalTitle(game, locale),
                developerNames(game).join(' / '),
                released === undefined ? undefined : String(released.getFullYear()),
                game.resources.count === 0
                  ? tGame('noResources')
                  : tGame('resources', { count: game.resources.count }),
              ]
                .filter(part => part !== undefined && part !== '')
                .join(' · '),
              icon: Gamepad2,
              onSelect: () => go(`/${locale}/game/${game.id}`, true),
            }
          }),
          {
            id: 'see-all',
            label: t('seeAll', { query, total: results?.games.total ?? 0 }),
            icon: ArrowRight,
            onSelect: () => {
              palette.remember()
              go(`/${locale}/search?${new URLSearchParams({ q: query })}`)
            },
          },
        ],
      })
    }
    if (developers.length > 0) {
      groups.push({
        label: t('groups.developers'),
        items: developers.map(developer => ({
          id: `developer:${developer.id}`,
          label: developer.name,
          description: t('works', { count: developer.works_count }),
          icon: Building2,
          onSelect: () => go(`/${locale}/developer/${developer.id}`, true),
        })),
      })
    }
    if (characters.length > 0) {
      groups.push({
        label: t('groups.characters'),
        items: characters.map(character => ({
          id: `character:${character.id}`,
          label: characterName(character, locale),
          description: character.game === null ? undefined : gameTitle(character.game, locale),
          icon: UserRound,
          onSelect: () => go(`/${locale}/character/${character.id}`, true),
        })),
      })
    }
    if (groups.length === 0) {
      return [status('empty', t('empty', { query }), SearchX)]
    }
    return groups
  }

  const items: CommandItems = []
  if (query === '') {
    if (palette.recent.length > 0) {
      items.push({
        label: t('groups.recent'),
        items: [
          ...palette.recent.map(term => ({
            id: `recent:${term}`,
            label: term,
            icon: History,
            onSelect: () => palette.fill(term),
          })),
          {
            id: 'recent:clear',
            label: t('clearRecent'),
            icon: Trash2,
            onSelect: palette.clearRecent,
          },
        ],
      })
    }
    const trending = palette.palette?.trending ?? []
    if (trending.length > 0) {
      items.push({
        label: t('groups.trending'),
        items: trending.map(term => ({
          id: `trending:${term}`,
          label: term,
          icon: TrendingUp,
          onSelect: () => palette.fill(term),
        })),
      })
    }
    items.push(shortcutGroup)
  } else {
    const suggestions = palette.palette?.suggestions ?? []
    if (suggestions.length > 0) {
      items.push({
        label: t('groups.suggestions'),
        items: suggestions.map(title => ({
          id: `suggest:${title}`,
          label: title,
          icon: Search,
          onSelect: () => palette.fill(title),
        })),
      })
    }
    if (palette.palette === undefined) {
      items.push(status('searching', t('searching'), Spinner))
    } else {
      items.push(...resultGroups(palette.palette))
    }
  }

  return (
    <>
      <Button
        variant="outline"
        tone="neutral"
        icon={<Search />}
        trailing={<Kbd>/</Kbd>}
        onClick={palette.show}
        className="w-full max-w-md justify-start max-md:hidden [&>.hn-transition]:flex-1"
      >
        <Text as="span" tone="muted" className="flex-1 text-start font-normal">
          {t('placeholder')}
        </Text>
      </Button>
      <Button
        variant="ghost"
        tone="neutral"
        iconOnly
        aria-label={t('label')}
        onClick={palette.show}
        className="ms-auto md:hidden"
      >
        <Search />
      </Button>
      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        search={palette.search}
        onSearchChange={palette.setSearch}
        items={items}
        ignoreFilter
        hotkey="mod+k"
        label={t('label')}
        placeholder={t('placeholder')}
      />
    </>
  )
}
