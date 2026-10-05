import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Image,
  ImageGroup,
  Inline,
  Link,
  Masonry,
  Section,
  SegmentedControl,
  Spoiler,
  SimpleGrid,
  Stack,
  Tag,
  Text,
} from '@hina-ui/react'
import { useState } from 'react'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import {
  groupStaff,
  imageSize,
  introIn,
  masked,
  writtenIntros,
  type GameDetails,
  type GameImage,
  type IntroLanguage,
} from '../game'
import { introLanguageFrom } from '../game.schema'
import { GameRow } from './game-row'

const factListClass =
  'grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 [&>dd]:m-0! [&>dt]:m-0!'

export function GameInfo({ details }: { details: GameDetails }) {
  const tags = details.tags ?? []
  const staff = groupStaff(details.staffs ?? [])
  const images = details.images ?? []
  const relations = details.relations_from ?? []
  const extra = details.extra_info ?? []
  const links = details.link ?? []
  const t = useTranslations('game.info')
  return (
    <Stack gap="xl">
      <Intro details={details} />
      {tags.length > 0 && (
        <Section title={t('tags')}>
          <Inline gap="xs">
            {tags.map(link => (
              <Tag key={link.tag.id}>{link.tag_alias ?? link.tag.name}</Tag>
            ))}
          </Inline>
        </Section>
      )}
      {images.length > 0 && <Screenshots images={images} contentLimit={details.content_limit} />}
      {staff.length > 0 && (
        <Section title={t('staff')}>
          <DescriptionList className={factListClass}>
            {staff.map(group => (
              <Facts key={group.role} term={group.role} details={group.names.join(' / ')} />
            ))}
          </DescriptionList>
        </Section>
      )}
      {relations.length > 0 && <Relations relations={relations} />}
      {extra.length > 0 && (
        <Section title={t('extra')}>
          <DescriptionList className={factListClass}>
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

function Intro({ details }: { details: GameDetails }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const written = writtenIntros(details, locale)
  const [chosen, setChosen] = useState<IntroLanguage | undefined>(undefined)
  const language = chosen !== undefined && written.includes(chosen) ? chosen : written[0]
  const choose = (value: string | number) => setChosen(introLanguageFrom(value))
  return (
    <Section title={t('info.intro')}>
      {written.length > 1 && language !== undefined && (
        <SegmentedControl
          aria-label={t('info.introLanguage')}
          size="sm"
          value={language}
          onValueChange={choose}
          options={written.map(value => ({ value, label: t(`introLanguage.${value}`) }))}
          className="self-start"
        />
      )}
      <Text className="whitespace-pre-line" tone={language === undefined ? 'muted' : undefined}>
        {language === undefined ? t('info.noIntro') : introIn(details, language)}
      </Text>
    </Section>
  )
}

function Screenshots({ images, contentLimit }: { images: GameImage[]; contentLimit: number }) {
  const t = useTranslations('game')
  const positions = images.map((image, index) => ({ image, index }))
  return (
    <Section title={t('info.screenshots')}>
      <ImageGroup>
        <Masonry items={positions} getKey={entry => entry.index} minColumnWidth={240} gap="sm">
          {({ item }) => {
            const size = imageSize(item.image)
            const screenshot = (
              <Image
                src={item.image.url}
                alt={t('info.screenshot')}
                ratio={size === undefined ? 16 / 9 : size.width / size.height}
                preview
                previewSize={size}
                className="rounded-lg"
              />
            )
            return masked(item.image, contentLimit) ? (
              <Spoiler aria-label={t('cover.explicit')} className="block rounded-lg">
                {screenshot}
              </Spoiler>
            ) : (
              screenshot
            )
          }}
        </Masonry>
      </ImageGroup>
    </Section>
  )
}

function Relations({ relations }: { relations: NonNullable<GameDetails['relations_from']> }) {
  const t = useTranslations('game.info')
  const labels = useMessages().game.relation
  return (
    <Section title={t('relations')}>
      <SimpleGrid min="20rem" gap="md">
        {relations.map(relation => (
          <Stack key={relation.id} gap="xs">
            <Text size="sm" tone="muted">
              {labelOf(labels, relation.relation)}
            </Text>
            <GameRow game={relation.to_game} />
          </Stack>
        ))}
      </SimpleGrid>
    </Section>
  )
}
