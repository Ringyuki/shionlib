import { Inline, Link, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  hikarinagiEditUrl,
  hikarinagiEntryUrl,
  type CatalogEntity,
} from '~/shared/catalog/hikarinagi'
import { usePublicConfig } from '~/shared/config/public-config'
import HikarinagiWordmark from './hikarinagi-wordmark.svg?react'

type CatalogAttributionProps = {
  entity: CatalogEntity
  id: number
  className?: string
}

export function CatalogAttribution({ entity, id, className }: CatalogAttributionProps) {
  const t = useTranslations('site')
  const { hikarinagiSiteUrl } = usePublicConfig()
  return (
    <Inline gap="xs" align="center" className={className}>
      <Text size="xs" tone="muted">
        {t('catalogSource')}
      </Text>
      <Link
        href={hikarinagiEntryUrl(hikarinagiSiteUrl, entity, id)}
        target="_blank"
        rel="noreferrer"
        aria-label={t('catalogEntry')}
        className="inline-flex"
      >
        <HikarinagiWordmark aria-hidden focusable="false" className="aspect-[792/191] h-4 w-auto" />
      </Link>
    </Inline>
  )
}

export function CatalogCorrection({ entity, id }: { entity: CatalogEntity; id: number }) {
  const t = useTranslations('site')
  const { hikarinagiSiteUrl } = usePublicConfig()
  return (
    <Inline gap="xs" align="baseline">
      <Text size="sm" tone="muted">
        {t('catalogCorrection')}
      </Text>
      <Link
        href={hikarinagiEditUrl(hikarinagiSiteUrl, entity, id)}
        target="_blank"
        rel="noreferrer"
        className="text-sm"
      >
        {t('catalogEdit')}
      </Link>
    </Inline>
  )
}
