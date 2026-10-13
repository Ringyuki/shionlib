import {
  Card,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Link,
  Text,
  Time,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { adminPaths, ModerationHistory, PaneSection, titleOf } from '~/features/admin'
import { gamePath } from '~/features/game'
import { RichText } from '~/shared/ui/rich-text'
import type { Opened } from '../admin-comment'

export function CommentFacts({ opened }: { opened: Opened }) {
  const t = useTranslations('adminComment.pane')
  const locale = useLocale()
  const { detail, author } = opened
  return (
    <>
      <PaneSection label={t('comment')}>
        <Card>
          <RichText document={detail.content} />
        </Card>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('game')}</DescriptionTerm>
          <DescriptionDetails>
            <Link
              href={gamePath(locale, detail.game.id, 'comments')}
              target="_blank"
              rel="noreferrer"
            >
              {titleOf(detail.game)}
            </Link>
          </DescriptionDetails>
          <DescriptionTerm>{t('author')}</DescriptionTerm>
          <DescriptionDetails>
            <Link asChild>
              <RouterLink to={adminPaths.user(detail.creator.id)}>{detail.creator.name}</RouterLink>
            </Link>
            <Text as="span" tone="muted" size="inherit">
              {t.rich('authorFacts', {
                written: author.written,
                blocked: author.blocked,
                joined: () => <Time value={author.joined} format="date" />,
              })}
            </Text>
          </DescriptionDetails>
          <DescriptionTerm>{t('written')}</DescriptionTerm>
          <DescriptionDetails>
            <Time value={detail.created} />
          </DescriptionDetails>
        </DescriptionList>
      </PaneSection>
      <PaneSection label={t('history')}>
        <ModerationHistory runs={detail.moderations ?? []} />
      </PaneSection>
    </>
  )
}
