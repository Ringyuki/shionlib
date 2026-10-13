import { Empty, Heading, Inline, Link, Section, Stack, Text } from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { GameGrid } from '~/features/game'
import { homepageOf, type TranslatorContent } from '../translator'

export function TranslatorPage({ content }: { content: TranslatorContent }) {
  const t = useTranslations('translator')
  const format = useFormatter()
  const { translator, works } = content
  const aliases = translator.aliases ?? []
  const homepage = homepageOf(translator)
  return (
    <Stack gap="xl">
      <Stack as="header" gap="sm">
        <Heading level={1} size="2xl" weight="semibold" className="break-words max-sm:text-xl">
          {translator.name}
        </Heading>
        {aliases.length > 0 && <Text tone="muted">{format.list(aliases)}</Text>}
        {homepage !== undefined && (
          <Link href={homepage} target="_blank" rel="noreferrer" className="self-start">
            <Inline as="span" gap="xs" align="center" wrap={false}>
              {t('homepage')}
              <ExternalLink aria-hidden className="size-3.5" />
            </Inline>
          </Link>
        )}
      </Stack>
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
