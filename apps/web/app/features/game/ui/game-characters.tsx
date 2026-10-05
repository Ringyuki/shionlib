import { Card, Empty, Image, Section, SimpleGrid, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { characterName } from '~/features/character'
import { groupCharacters, type CharacterCredit } from '../game'

export function GameCharacters({ characters }: { characters: readonly CharacterCredit[] }) {
  const t = useTranslations('game.characters')
  const groups = groupCharacters(characters)
  if (groups.length === 0) {
    return <Empty title={t('empty')} />
  }
  return (
    <Stack gap="xl">
      {groups.map(group => (
        <Section key={group.role} title={t(`role.${group.role}`)}>
          <SimpleGrid min="9rem" gap="md">
            {group.credits.map(credit => (
              <CharacterCard key={credit.character.id} credit={credit} />
            ))}
          </SimpleGrid>
        </Section>
      ))}
    </Stack>
  )
}

function CharacterCard({ credit }: { credit: CharacterCredit }) {
  const t = useTranslations('game.characters')
  const locale = useLocale()
  const name = characterName(credit.character, locale)
  return (
    <Card padded={false} className="hn-interactive overflow-hidden">
      <Link to={`/${locale}/character/${credit.character.id}`} prefetch="intent">
        <Image
          src={credit.image ?? credit.character.image ?? undefined}
          alt={name}
          ratio={3 / 4}
          fit="cover"
          imageClass="object-top"
        />
        <Stack gap="none" className="p-2.5">
          <Text size="sm" weight="medium" truncate>
            {name}
          </Text>
          {credit.actor !== null && credit.actor !== '' && (
            <Text size="xs" tone="muted" truncate>
              {t('voice', { name: credit.actor })}
            </Text>
          )}
        </Stack>
      </Link>
    </Card>
  )
}
