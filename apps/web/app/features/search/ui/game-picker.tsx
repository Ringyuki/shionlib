import { Combobox, Image, Inline, Stack, Text } from '@hina-ui/react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerNames, gameTitle, primaryCover } from '~/features/game'
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
  const { search, setSearch, games, loading } = useGameOptions()
  const choices: GameChoice[] = games.map(game => ({
    value: game.id,
    label: gameTitle(game, locale),
    cover: primaryCover(game)?.url,
    developers: format.list(developerNames(game)),
  }))
  return (
    <Combobox
      value={null}
      onValueChange={value => {
        const choice = choices.find(candidate => candidate.value === value)
        if (choice !== undefined) {
          onPick(choice.value)
        }
      }}
      search={search}
      onSearchChange={setSearch}
      options={choices}
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
