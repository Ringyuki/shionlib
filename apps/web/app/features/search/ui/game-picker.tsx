import { Combobox, Image, Inline, Stack, Text, type SelectItems } from '@hina-ui/react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerNames, gameTitle, primaryCover } from '~/features/game'
import type { GameHit } from '../search'
import { useGameOptions } from '../use-game-options'

type GamePickerProps = {
  onPick: (gameId: number) => void
  invalid?: boolean
}

type GameChoice = {
  value: number
  label: string
  cover: string | undefined
  developers: string
}

export function GamePicker({ onPick, invalid }: GamePickerProps) {
  const t = useTranslations('search')
  const locale = useLocale()
  const format = useFormatter()
  const { search, setSearch, searching, found, recent, loading } = useGameOptions()
  const choice = (game: GameHit): GameChoice => ({
    value: game.id,
    label: gameTitle(game, locale),
    cover: primaryCover(game)?.url,
    developers: format.list(developerNames(game)),
  })
  const released = [
    { label: t('released.thisMonth'), games: recent?.thisMonth ?? [] },
    { label: t('released.lastMonth'), games: recent?.lastMonth ?? [] },
  ]
  const options: SelectItems<GameChoice> = searching
    ? found.map(choice)
    : released
        .filter(group => group.games.length > 0)
        .map(group => ({ label: group.label, options: group.games.map(choice) }))
  return (
    <Combobox
      value={null}
      onValueChange={value => {
        if (typeof value === 'number') {
          onPick(value)
        }
      }}
      search={search}
      onSearchChange={setSearch}
      options={options}
      renderOption={({ option }) => <GameOption choice={option} />}
      loading={loading}
      ignoreFilter
      invalid={invalid}
      placeholder={t('pickGame')}
      aria-label={t('pickGame')}
    />
  )
}

function GameOption({ choice }: { choice: GameChoice }) {
  return (
    <Inline gap="sm" align="center" wrap={false}>
      <Image
        src={choice.cover}
        alt=""
        ratio={3 / 4}
        fit="cover"
        className="w-9 shrink-0 rounded-sm"
      />
      <Stack gap="none" className="min-w-0">
        <Text size="sm" weight="medium" truncate>
          {choice.label}
        </Text>
        {choice.developers !== '' && (
          <Text size="xs" tone="muted" truncate>
            {choice.developers}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
