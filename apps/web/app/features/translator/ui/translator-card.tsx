import { Card, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { translatorPath, type TranslatorItem } from '../translator'

export function TranslatorCard({ translator }: { translator: TranslatorItem }) {
  const t = useTranslations('translator')
  const locale = useLocale()
  const format = useFormatter()
  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link
        to={translatorPath(locale, translator.id)}
        prefetch="intent"
        className="block h-full px-4 py-3.5"
      >
        <Stack gap="none" className="min-w-0">
          <Text weight="semibold" truncate>
            {translator.name}
          </Text>
          <Text size="sm" tone="muted" truncate className="min-h-[1lh]">
            {format.list(translator.aliases ?? [])}
          </Text>
          <Text size="xs" tone="faint" className="tabular-nums">
            {t('works', { count: translator.works_count })}
          </Text>
        </Stack>
      </Link>
    </Card>
  )
}
