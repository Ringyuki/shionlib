import { Callout, Link, Text } from '@hina-ui/react'
import { Combine } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { CompositionOrigin } from '../resource-composition'
import { resourcePath } from '../resource-page'

export function CompositionLineage({ origin }: { origin: CompositionOrigin }) {
  const t = useTranslations('resource.composition')
  const locale = useLocale()
  const version = origin.patch_version ?? 'none'
  return (
    <Callout icon={<Combine aria-hidden />}>
      <Text as="span">
        {origin.base_gone
          ? t('lineageGone', { version })
          : t.rich('lineage', {
              version,
              base: chunks => (
                <Link asChild>
                  <RouterLink to={resourcePath(locale, origin.base.resource_id)} prefetch="intent">
                    {chunks}
                  </RouterLink>
                </Link>
              ),
            })}
      </Text>
    </Callout>
  )
}
