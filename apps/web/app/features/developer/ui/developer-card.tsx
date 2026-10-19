import { Card, Inline, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { developerPath, type DeveloperItem } from '../developer'
import { DeveloperLogo } from './developer-logo'

export function DeveloperCard({ developer }: { developer: DeveloperItem }) {
  const t = useTranslations('developer')
  const locale = useLocale()
  const format = useFormatter()
  const aliases = developer.aliases ?? []
  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link to={developerPath(locale, developer.id)} prefetch="intent" className="block h-full p-3">
        <Inline gap="md" align="center" wrap={false}>
          <DeveloperLogo
            src={developer.logo}
            thumbhash={developer.logo_thumb_hash}
            className="size-14 shrink-0 rounded-lg bg-inset"
          />
          <Stack gap="none" className="min-w-0 flex-1">
            <Text weight="medium" truncate>
              {developer.name}
            </Text>
            <Text size="sm" tone="muted" truncate className="min-h-[1lh]">
              {format.list(aliases)}
            </Text>
            <Text size="xs" tone="faint" className="tabular-nums">
              {t('works', { count: developer.works_count })}
            </Text>
          </Stack>
        </Inline>
      </Link>
    </Card>
  )
}
