import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Section,
  Stack,
} from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { CatalogCorrection } from '~/shared/ui/catalog-attribution'
import { groupStaff, type GameDetails } from '../game'
import { GameIntro } from './game-intro'
import { GameRelations } from './game-relations'
import { GameScreenshots } from './game-screenshots'
import { GameTags } from './game-tags'

export function GameInfo({ details, entry }: { details: GameDetails; entry: number | null }) {
  const tags = details.tags ?? []
  const staff = groupStaff(details.staffs ?? [])
  const images = details.images ?? []
  const relations = details.relations_from ?? []
  const extra = details.extra_info ?? []
  const links = details.link ?? []
  const t = useTranslations('game.info')
  const format = useFormatter()
  return (
    <Stack gap="xl">
      <GameIntro details={details} />
      {tags.length > 0 && <GameTags tags={tags} />}
      {images.length > 0 && (
        <GameScreenshots images={images} contentLimit={details.content_limit} />
      )}
      {staff.length > 0 && (
        <Section title={t('staff')}>
          <DescriptionList orientation="horizontal">
            {staff.map(group => (
              <Facts key={group.role} term={group.role} details={format.list(group.names)} />
            ))}
          </DescriptionList>
        </Section>
      )}
      {relations.length > 0 && <GameRelations relations={relations} />}
      {extra.length > 0 && (
        <Section title={t('extra')}>
          <DescriptionList orientation="horizontal">
            {extra.map(entry => (
              <Facts key={entry.key} term={entry.key} details={entry.value} />
            ))}
          </DescriptionList>
        </Section>
      )}
      {links.length > 0 && (
        <Section title={t('links')}>
          <Inline gap="md">
            {links.map(link => (
              <Link key={link.id} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </Link>
            ))}
          </Inline>
        </Section>
      )}
      {entry !== null && <CatalogCorrection entity="galgame" id={entry} />}
    </Stack>
  )
}

function Facts({ term, details }: { term: string; details: string }) {
  return (
    <>
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails>{details}</DescriptionDetails>
    </>
  )
}
