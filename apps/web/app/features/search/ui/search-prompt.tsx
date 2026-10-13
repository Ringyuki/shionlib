import { Chip, Inline, Section, Stack, Text } from '@hina-ui/react'
import { TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { resultsSearch } from '../search'

export function SearchPrompt({ trending }: { trending: readonly string[] }) {
  const t = useTranslations('search.results')
  const locale = useLocale()
  return (
    <Stack gap="lg">
      <Text size="sm" tone="muted">
        {t('prompt')}
      </Text>
      {trending.length > 0 && (
        <Section title={t('trending')}>
          <Inline gap="xs">
            {trending.map(term => (
              <Chip key={term} asChild className="gap-1">
                <Link to={`/${locale}/search${resultsSearch({ query: term })}`}>
                  <TrendingUp aria-hidden />
                  {term}
                </Link>
              </Chip>
            ))}
          </Inline>
        </Section>
      )}
    </Stack>
  )
}
