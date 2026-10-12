import {
  Card,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { adminPaths, ModerationHistory, PaneSection, titleOf } from '~/features/admin'
import { walkthroughPath } from '~/features/walkthrough'
import { RichText } from '~/shared/ui/rich-text'
import { languageOf, stepsOf, type WalkthroughDetail } from '../admin-walkthrough'
import { StatusTags } from './walkthrough-table'

export function WalkthroughFacts({ detail }: { detail: WalkthroughDetail }) {
  const t = useTranslations('adminWalkthrough')
  const locale = useLocale()
  const routes = detail.routes ?? []
  return (
    <>
      <PaneSection label={t('pane.walkthrough')}>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('pane.game')}</DescriptionTerm>
          <DescriptionDetails>
            <Link
              href={walkthroughPath(locale, detail.game.id, detail.id)}
              target="_blank"
              rel="noreferrer"
            >
              {titleOf(detail.game)}
            </Link>
          </DescriptionDetails>
          <DescriptionTerm>{t('column.author')}</DescriptionTerm>
          <DescriptionDetails>
            <Link asChild>
              <RouterLink to={adminPaths.user(detail.creator.id)}>{detail.creator.name}</RouterLink>
            </Link>
          </DescriptionDetails>
          <DescriptionTerm>{t('column.language')}</DescriptionTerm>
          <DescriptionDetails>{t(`language.${languageOf(detail)}`)}</DescriptionDetails>
          <DescriptionTerm>{t('column.updated')}</DescriptionTerm>
          <DescriptionDetails>
            <Time value={detail.updated} />
          </DescriptionDetails>
          <DescriptionTerm>{t('column.status')}</DescriptionTerm>
          <DescriptionDetails>
            <StatusTags walkthrough={{ status: detail.status, held: false }} />
          </DescriptionDetails>
        </DescriptionList>
      </PaneSection>
      {detail.note !== undefined && (
        <PaneSection label={t('pane.note')}>
          <Card>
            <RichText document={detail.note} />
          </Card>
        </PaneSection>
      )}
      <PaneSection label={t('pane.routes', { count: routes.length })}>
        {routes.length === 0 ? (
          <Text as="span" size="sm" tone="muted">
            {t('pane.noRoutes')}
          </Text>
        ) : (
          <Card padded={false}>
            <Stack gap="none" className="divide-line divide-y">
              {routes.map(route => (
                <Inline
                  key={route.key}
                  gap="md"
                  align="center"
                  justify="between"
                  wrap={false}
                  className="px-(--hn-panel-p) py-2.5"
                >
                  <Text as="span" size="sm" weight="medium" className="min-w-0 break-words">
                    {route.name === '' ? t('pane.unnamed') : route.name}
                  </Text>
                  <Text as="span" size="sm" tone="muted" className="shrink-0 tabular-nums">
                    {t('pane.steps', { count: stepsOf(route) })}
                  </Text>
                </Inline>
              ))}
            </Stack>
          </Card>
        )}
      </PaneSection>
      <PaneSection label={t('pane.history')}>
        <ModerationHistory runs={detail.moderations ?? []} />
      </PaneSection>
    </>
  )
}
