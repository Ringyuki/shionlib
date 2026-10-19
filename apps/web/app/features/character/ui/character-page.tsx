import { Center, Empty, Grid, Heading, Image, Inline, Section, Stack, Text } from '@hina-ui/react'
import { UserRound } from 'lucide-react'
import { useLocale, useTranslations } from 'use-intl'
import { GameGrid, preferredIntro } from '~/features/game'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { CatalogAttribution } from '~/shared/ui/catalog-attribution'
import { appearanceIn, characterName, otherNames, type CharacterContent } from '../character'
import { AppearanceNote } from './appearance-note'
import { CharacterFacts } from './character-facts'

export function CharacterPage({ content }: { content: CharacterContent }) {
  const t = useTranslations('character')
  const locale = useLocale()
  const { character, works } = content
  const name = characterName(character, locale)
  const intro = preferredIntro(character, locale)
  return (
    <Stack gap="xl">
      <Grid
        as="header"
        className="grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-8"
      >
        <Image
          src={character.image ?? undefined}
          thumbhash={character.image_thumb_hash ?? undefined}
          alt={name}
          ratio={3 / 4}
          fit="cover"
          eager
          imageClass="object-top"
          empty={
            <Center className="size-full text-muted">
              <UserRound aria-hidden className="size-10" />
            </Center>
          }
          className="self-start rounded-xl bg-inset sm:row-span-2"
        />
        <Stack gap="sm" className="min-w-0">
          <Heading level={1} size="2xl" weight="semibold" className="text-balance max-sm:text-xl">
            {name}
          </Heading>
          <Inline gap="lg" className="gap-y-1">
            {otherNames(character, locale).map(other => (
              <Text key={other} tone="muted" className="sm:text-lg">
                {other}
              </Text>
            ))}
          </Inline>
          {character.h_id !== null && <CatalogAttribution entity="character" id={character.h_id} />}
        </Stack>
        <Stack className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
          <CharacterFacts character={character} />
        </Stack>
      </Grid>
      {intro !== '' && (
        <Section title={t('intro')}>
          <BBCodeText source={intro} className="max-w-prose" />
        </Section>
      )}
      <Section title={t('works', { count: works.total })}>
        <GameGrid
          label={t('worksLabel')}
          works={works}
          empty={<Empty title={t('noWorks')} size="sm" />}
          renderNote={game => {
            const appearance = appearanceIn(character, game.id)
            return appearance === undefined ? null : <AppearanceNote appearance={appearance} />
          }}
        />
      </Section>
    </Stack>
  )
}
