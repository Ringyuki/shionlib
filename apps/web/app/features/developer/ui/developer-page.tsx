import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Empty,
  Heading,
  Inline,
  Link,
  Section,
  Stack,
  Text,
} from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { Fragment } from 'react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { GameGrid, preferredIntro } from '~/features/game'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { CatalogAttribution } from '~/shared/ui/catalog-attribution'
import { extrasOf, websiteOf, type DeveloperContent } from '../developer'
import { DeveloperLogo } from './developer-logo'

const factListClass =
  'grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2 [&>dd]:m-0! [&>dt]:m-0!'

export function DeveloperPage({ content }: { content: DeveloperContent }) {
  const t = useTranslations('developer')
  const locale = useLocale()
  const format = useFormatter()
  const { developer, works } = content
  const aliases = developer.aliases ?? []
  const intro = preferredIntro(developer, locale)
  const website = websiteOf(developer)
  const extras = extrasOf(developer)
  return (
    <Stack gap="xl">
      <Inline as="header" gap="lg" align="start" wrap={false} className="max-sm:gap-4">
        <DeveloperLogo
          src={developer.logo}
          eager
          className="size-20 shrink-0 rounded-xl bg-inset sm:size-24"
        />
        <Stack gap="sm" className="min-w-0 flex-1">
          <Heading level={1} size="2xl" weight="semibold" className="break-words max-sm:text-xl">
            {developer.name}
          </Heading>
          {aliases.length > 0 && <Text tone="muted">{format.list(aliases)}</Text>}
          <Inline gap="lg" align="center" className="gap-y-2">
            {website !== undefined && (
              <Link href={website} target="_blank" rel="noreferrer">
                <Inline as="span" gap="xs" align="center" wrap={false}>
                  {t('website')}
                  <ExternalLink aria-hidden className="size-3.5" />
                </Inline>
              </Link>
            )}
            {developer.h_id !== null && (
              <CatalogAttribution entity="producer" id={developer.h_id} />
            )}
          </Inline>
        </Stack>
      </Inline>
      {intro !== '' && (
        <Section title={t('intro')}>
          <BBCodeText source={intro} className="max-w-prose" />
        </Section>
      )}
      {extras.length > 0 && (
        <Section title={t('extra')}>
          <DescriptionList className={factListClass}>
            {extras.map(info => (
              <Fragment key={`${info.key}:${info.value}`}>
                <DescriptionTerm>{info.key}</DescriptionTerm>
                <DescriptionDetails className="break-all">{info.value}</DescriptionDetails>
              </Fragment>
            ))}
          </DescriptionList>
        </Section>
      )}
      <Section title={t('worksTitle', { count: works.total })}>
        <GameGrid
          label={t('worksLabel')}
          works={works}
          sortable
          empty={<Empty title={t('noWorks')} size="sm" />}
        />
      </Section>
    </Stack>
  )
}
