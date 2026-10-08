import { AlertDialog, Anchor, Grid, Heading, Inline, Link, Stack, toast } from '@hina-ui/react'
import { ArrowLeft, PencilLine, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { bbcodeSections, parseBBCode } from '~/shared/markup/bbcode'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { Button } from '~/shared/ui/button'
import { useWalkthroughRemoval } from '../use-walkthrough-removal'
import { contentsOf, editorPath, walkthroughsPath, type Reading } from '../walkthrough'
import { WalkthroughFacts } from './walkthrough-facts'

export function WalkthroughPage({ reading, own }: { reading: Reading; own: boolean }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const navigate = useNavigate()
  const removal = useWalkthroughRemoval()
  const [removing, setRemoving] = useState(false)
  const { game, walkthrough, source } = reading
  const contents = useMemo(() => contentsOf(bbcodeSections(parseBBCode(source))), [source])
  const list = walkthroughsPath(locale, game.id)
  return (
    <Grid className="items-start gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <Stack as="article" gap="lg" className="mx-auto w-full max-w-prose min-w-0">
        <Stack as="header" gap="sm">
          <Link asChild tone="neutral" className="self-start text-sm">
            <RouterLink to={list}>
              <Inline as="span" gap="xs" align="center" wrap={false}>
                <ArrowLeft aria-hidden className="size-3.5" />
                {t('back', { game: gameTitle(game, locale) })}
              </Inline>
            </RouterLink>
          </Link>
          <Heading level={1} size="2xl" weight="semibold" className="text-balance break-words">
            {walkthrough.title}
          </Heading>
          <WalkthroughFacts walkthrough={walkthrough} />
          {own && (
            <Inline gap="sm">
              <Button asChild size="sm" variant="outline" tone="neutral" icon={<PencilLine />}>
                <RouterLink to={editorPath(locale, game.id, walkthrough.id)}>
                  {t('edit')}
                </RouterLink>
              </Button>
              <Button
                size="sm"
                variant="outline"
                tone="danger"
                icon={<Trash2 />}
                onClick={() => setRemoving(true)}
              >
                {t('remove')}
              </Button>
            </Inline>
          )}
        </Stack>
        <BBCodeText source={source} />
      </Stack>
      {contents.length > 0 && (
        <Stack as="aside" className="sticky top-4 max-lg:hidden">
          <Anchor label={t('contents')} items={contents} />
        </Stack>
      )}
      <AlertDialog
        title={t('removeConfirm')}
        description={t('removeDescription')}
        confirmText={t('remove')}
        cancelText={t('cancel')}
        tone="danger"
        open={removing}
        onOpenChange={setRemoving}
        onConfirm={async () => {
          await removal.confirm({ walkthroughId: walkthrough.id })
          toast.success(t('removed'))
          void navigate(list)
        }}
      />
    </Grid>
  )
}
