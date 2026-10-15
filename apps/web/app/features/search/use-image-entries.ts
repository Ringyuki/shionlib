import type { SelectItems } from '@hina-ui/react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { characterName } from '~/features/character'
import { developerNames, gameTitle, primaryCover } from '~/features/game'
import { resultsSearch } from './search'
import { gameOf, listedSightings, type ImageFindings, type Sighting } from './search-image'
import type { PaletteEntry } from './use-palette-entries'

export function useImageEntries(
  findings: ImageFindings,
  crops: readonly string[],
  close: () => void,
): SelectItems<PaletteEntry> {
  const t = useTranslations('search')
  const format = useFormatter()
  const locale = useLocale()
  const navigate = useNavigate()
  const go = (to: string) => {
    close()
    void navigate(to)
  }
  const searchFor = (work: string) => `/${locale}/search${resultsSearch({ query: work })}`
  const destination = (sighting: Sighting) => {
    const game = gameOf(findings.games, sighting.game_id)
    if (sighting.character !== null) {
      return `/${locale}/character/${sighting.character.id}`
    }
    return game === undefined ? searchFor(sighting.work) : `/${locale}/game/${game.id}`
  }

  const games = [
    ...(findings.games ?? []).map((game): PaletteEntry => ({
      kind: 'picture',
      value: `image-game:${game.id}`,
      label: gameTitle(game, locale),
      description: format.list(developerNames(game)),
      picture: { shape: 'cover', cover: primaryCover(game) },
      action: () => go(`/${locale}/game/${game.id}`),
    })),
    ...(findings.unlisted_works ?? []).map((work): PaletteEntry => ({
      kind: 'command',
      value: `image-work:${work}`,
      label: t('image.searchWork', { work }),
      icon: Search,
      action: () => go(searchFor(work)),
    })),
  ]
  const characters = listedSightings(findings.characters).map(
    ({ sighting, index }): PaletteEntry => {
      const game = gameOf(findings.games, sighting.game_id)
      return {
        kind: 'picture',
        value: `image-character:${index}`,
        label:
          sighting.character === null
            ? sighting.name || sighting.work
            : characterName(sighting.character, locale),
        description: game === undefined ? sighting.work : gameTitle(game, locale),
        note: sighting.unsure ? t('image.unsure') : undefined,
        picture: { shape: 'portrait', src: crops[index] || undefined },
        action: () => go(destination(sighting)),
      }
    },
  )
  return [
    ...(games.length === 0 ? [] : [{ label: t('groups.games'), options: games }]),
    ...(characters.length === 0 ? [] : [{ label: t('groups.characters'), options: characters }]),
  ]
}
