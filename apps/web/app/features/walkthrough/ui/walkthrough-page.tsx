import { Anchor, Divider, Grid, Heading, Inline, Stack } from '@hina-ui/react'
import { useMemo } from 'react'
import { useTranslations } from 'use-intl'
import { sectionsOf } from '~/shared/richtext/rich-text'
import { RichText } from '~/shared/ui/rich-text'
import { contentsOf, type Reading } from '../walkthrough'
import { WalkthroughByline } from './walkthrough-byline'
import { WalkthroughContents } from './walkthrough-contents'
import { WalkthroughGame } from './walkthrough-game'
import { WalkthroughNotice } from './walkthrough-notice'
import { WalkthroughOthers } from './walkthrough-others'
import { WalkthroughOwnerActions } from './walkthrough-owner-actions'
import { WalkthroughTrail } from './walkthrough-trail'

export function WalkthroughPage({ reading, own }: { reading: Reading; own: boolean }) {
  const t = useTranslations('walkthrough')
  const { game, resources, walkthrough, content, others } = reading
  const contents = useMemo(() => contentsOf(sectionsOf(content)), [content])
  return (
    <Grid className="items-start justify-center gap-10 lg:grid-cols-[minmax(0,48rem)_15rem]">
      <Stack as="article" gap="xl" className="min-w-0">
        <Stack as="header" gap="lg">
          <WalkthroughTrail game={game} />
          <Heading level={1} className="text-3xl tracking-tight text-balance break-words">
            {walkthrough.title}
          </Heading>
          <Inline justify="between" align="center" gap="md" wrap={false}>
            <WalkthroughByline walkthrough={walkthrough} />
            {own && <WalkthroughOwnerActions gameId={game.id} walkthroughId={walkthrough.id} />}
          </Inline>
          {own && <WalkthroughNotice walkthrough={walkthrough} />}
          <WalkthroughContents contents={contents} className="lg:hidden" />
          <Divider className="max-lg:hidden" />
        </Stack>
        <RichText document={content} anchored />
        <WalkthroughOthers gameId={game.id} others={others} />
      </Stack>
      <Stack as="aside" gap="lg" className="sticky top-6 max-lg:hidden">
        <WalkthroughGame game={game} resources={resources} />
        {contents.length > 0 && <Anchor label={t('contents')} items={contents} />}
      </Stack>
    </Grid>
  )
}
