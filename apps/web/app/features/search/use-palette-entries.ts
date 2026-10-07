import type { SelectOptionGroup } from '@hina-ui/react'
import { ArrowRight, History, Search, Trash2, TrendingUp, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { characterName } from '~/features/character'
import { developerNames, gameTitle, primaryCover } from '~/features/game'
import type { Palette, Picture } from './search'
import type { useSearchPalette } from './use-search-palette'

type EntryBase = {
  value: string
  label: string
  description?: string
  stays?: boolean
  action: () => void
}

export type PaletteEntry =
  | (EntryBase & { kind: 'picture'; picture: Picture })
  | (EntryBase & { kind: 'command'; icon: LucideIcon })

export type PaletteStatus = 'searching' | 'empty' | 'unavailable' | undefined

type EntryGroup = SelectOptionGroup<PaletteEntry>

type PaletteView = {
  groups: EntryGroup[]
  status: PaletteStatus
  searchAll: () => void
}

export function usePaletteEntries(palette: ReturnType<typeof useSearchPalette>): PaletteView {
  const t = useTranslations('search')
  const format = useFormatter()
  const locale = useLocale()
  const navigate = useNavigate()
  const { query } = palette

  const go = (to: string, settled = false) => {
    if (settled) {
      palette.settle()
    }
    palette.setOpen(false)
    void navigate(to)
  }

  const searchAll = () => {
    if (query === '') {
      return
    }
    palette.remember()
    go(`/${locale}/search?${new URLSearchParams({ q: query })}`)
  }

  const command = (
    value: string,
    label: string,
    icon: LucideIcon,
    action: () => void,
    extra: Pick<EntryBase, 'description' | 'stays'> = {},
  ): PaletteEntry => ({ kind: 'command', value, label, icon, action, ...extra })

  const fill = (value: string, term: string, icon: LucideIcon) =>
    command(value, term, icon, () => palette.fill(term), { stays: true })

  const group = (label: string, options: PaletteEntry[]): EntryGroup[] =>
    options.length === 0 ? [] : [{ label, options }]

  const resultGroups = (data: Palette): EntryGroup[] => {
    const results = data.results
    const games = results?.games.items ?? []
    return [
      ...group(t('groups.games'), [
        ...games.map((game): PaletteEntry => ({
          kind: 'picture',
          value: `game:${game.id}`,
          label: gameTitle(game, locale),
          description: format.list(developerNames(game)),
          picture: { src: primaryCover(game)?.url, shape: 'cover' },
          action: () => go(`/${locale}/game/${game.id}`, true),
        })),
        ...(games.length === 0
          ? []
          : [
              command(
                'see-all',
                t('seeAll', { query, total: results?.games.total ?? 0 }),
                ArrowRight,
                searchAll,
              ),
            ]),
      ]),
      ...group(
        t('groups.developers'),
        (results?.developers.items ?? []).map((developer): PaletteEntry => ({
          kind: 'picture',
          value: `developer:${developer.id}`,
          label: developer.name,
          description: t('works', { count: developer.works_count }),
          picture: { src: developer.logo ?? undefined, shape: 'logo' },
          action: () => go(`/${locale}/developer/${developer.id}`, true),
        })),
      ),
      ...group(
        t('groups.characters'),
        (results?.characters.items ?? []).map((character): PaletteEntry => ({
          kind: 'picture',
          value: `character:${character.id}`,
          label: characterName(character, locale),
          description: character.game === null ? undefined : gameTitle(character.game, locale),
          picture: { src: character.image ?? undefined, shape: 'portrait' },
          action: () => go(`/${locale}/character/${character.id}`, true),
        })),
      ),
    ]
  }

  if (query === '') {
    const recent = palette.recent.map(term => fill(`recent:${term}`, term, History))
    const groups = [
      ...group(
        t('groups.recent'),
        recent.length === 0
          ? []
          : [
              ...recent,
              command('recent:clear', t('clearRecent'), Trash2, palette.clearRecent, {
                stays: true,
              }),
            ],
      ),
      ...group(
        t('groups.trending'),
        (palette.palette?.trending ?? []).map(term => fill(`trending:${term}`, term, TrendingUp)),
      ),
    ]
    return { groups, status: undefined, searchAll }
  }

  const suggestions = group(
    t('groups.suggestions'),
    (palette.palette?.suggestions ?? []).map(title => fill(`suggest:${title}`, title, Search)),
  )
  if (palette.palette === undefined) {
    return { groups: suggestions, status: 'searching', searchAll }
  }
  if (palette.palette.unavailable) {
    return { groups: suggestions, status: 'unavailable', searchAll }
  }
  const results = resultGroups(palette.palette)
  return {
    groups: [...suggestions, ...results],
    status: results.length === 0 ? 'empty' : undefined,
    searchAll,
  }
}
