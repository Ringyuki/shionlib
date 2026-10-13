import { DescriptionDetails, DescriptionList, DescriptionTerm, Inline, Link } from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { FactsPart } from '~/features/inspection'
import { translatorPath } from '~/features/translator'
import { labelOf } from '~/shared/i18n/labels'
import type { Resource } from '../resource'
import { creditsOf, editionText } from '../resource-info'

export function InfoFacts({ resource }: { resource: Resource }) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const locale = useLocale()
  const format = useFormatter()
  const names = labels.resource
  const credits = creditsOf(resource)
  const extras = (resource.extras ?? []).map(extra => labelOf(names.extraName, extra))
  const { translation, release_url: release } = resource
  const facts: [string, ReactNode][] = [
    [
      t('languages'),
      format.list((resource.language ?? []).map(value => labelOf(labels.game.language, value))),
    ],
    [
      t('translation'),
      translation === null || translation === 'none'
        ? ''
        : labelOf(names.translationName, translation),
    ],
    [
      t('translators'),
      credits.length > 0 && (
        <Inline gap="sm" className="gap-y-0.5">
          {credits.map(translator => (
            <Link key={translator.id} asChild>
              <RouterLink to={translatorPath(locale, translator.id)} prefetch="intent">
                {translator.name}
              </RouterLink>
            </Link>
          ))}
        </Inline>
      ),
    ],
    [t('patchVersion'), resource.patch_version ?? ''],
    [
      t('releaseUrl'),
      release !== null && (
        <Link href={release} target="_blank" rel="noreferrer nofollow ugc" className="break-all">
          {release}
          <ExternalLink aria-hidden className="ms-1 inline size-3.5 align-[-0.125em]" />
        </Link>
      ),
    ],
    [t('edition'), editionText(resource, value => labelOf(names.editionName, value))],
    [t('form'), resource.form === null ? '' : labelOf(names.formName, resource.form)],
    [t('extras'), format.list(extras)],
  ]
  return (
    <FactsPart heading={t('page.details.resource')}>
      <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
        {facts
          .filter(([, value]) => value !== '' && value !== false)
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
