import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Link,
  Stack,
  Text,
} from '@hina-ui/react'
import { Fragment, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { FactsPart } from '~/features/inspection'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { CompositionOrigin } from '../resource-composition'
import { resourcePath } from '../resource-page'

export function CompositionFacts({ origin }: { origin: CompositionOrigin }) {
  const t = useTranslations('resource.composition.details')
  const locale = useLocale()
  const format = useFormatter()
  const bytes = useBytes()
  const part = (name: ReactNode, size: number) => (
    <Stack gap="none">
      {name}
      <Text size="sm" tone="muted" className="tabular-nums">
        {bytes(size)}
      </Text>
    </Stack>
  )
  const { base, patch, save } = origin
  const facts: [string, ReactNode][] = [
    [
      t('base'),
      part(
        origin.base_gone ? (
          <Text className="break-all">{base.name}</Text>
        ) : (
          <Link asChild className="break-all">
            <RouterLink to={resourcePath(locale, base.resource_id)} prefetch="intent">
              {base.name}
            </RouterLink>
          </Link>
        ),
        base.size,
      ),
    ],
    [
      t('patch'),
      patch === null ? null : part(<Text className="break-all">{patch.name}</Text>, patch.size),
    ],
    [
      t('save'),
      save === null ? null : part(<Text className="break-all">{save.name}</Text>, save.size),
    ],
    [
      t('finished'),
      origin.finished_at === null
        ? null
        : format.dateTime(new Date(origin.finished_at), { dateStyle: 'long', timeStyle: 'short' }),
    ],
  ]
  return (
    <FactsPart heading={t('heading')}>
      <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
        {facts
          .filter(([, value]) => value !== null)
          .map(([term, value]) => (
            <Fragment key={term}>
              <DescriptionTerm>{term}</DescriptionTerm>
              <DescriptionDetails>{value}</DescriptionDetails>
            </Fragment>
          ))}
      </DescriptionList>
    </FactsPart>
  )
}
