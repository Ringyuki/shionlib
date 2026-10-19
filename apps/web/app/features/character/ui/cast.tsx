import { Card, Empty, Image, Section, SimpleGrid, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import {
  castPicture,
  characterName,
  characterPath,
  groupCast,
  voiceOf,
  type CastCredit,
} from '../character'

export function Cast({ credits }: { credits: readonly CastCredit[] }) {
  const t = useTranslations('character.cast')
  const groups = groupCast(credits)
  if (groups.length === 0) {
    return <Empty title={t('empty')} />
  }
  return (
    <Stack gap="xl">
      {groups.map(group => (
        <Section key={group.role} title={t(`role.${group.role}`)}>
          <SimpleGrid min="9rem" gap="md">
            {group.credits.map(credit => (
              <CastCard key={credit.character.id} credit={credit} />
            ))}
          </SimpleGrid>
        </Section>
      ))}
    </Stack>
  )
}

function CastCard({ credit }: { credit: CastCredit }) {
  const t = useTranslations('character.cast')
  const locale = useLocale()
  const name = characterName(credit.character, locale)
  const voice = voiceOf(credit)
  const picture = castPicture(credit)
  return (
    <Card padded={false} className="hn-interactive overflow-hidden">
      <Link to={characterPath(locale, credit.character.id)} prefetch="intent">
        <Image
          src={picture.src}
          thumbhash={picture.thumbhash}
          alt={name}
          ratio={3 / 4}
          fit="cover"
          imageClass="object-top"
        />
        <Stack gap="none" className="p-2.5">
          <Text size="sm" weight="medium" truncate>
            {name}
          </Text>
          {voice !== undefined && (
            <Text size="xs" tone="muted" truncate>
              {t('voice', { name: voice })}
            </Text>
          )}
        </Stack>
      </Link>
    </Card>
  )
}
