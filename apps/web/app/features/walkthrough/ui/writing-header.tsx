import {
  DropdownMenu,
  DropdownMenuItem,
  Inline,
  Link,
  PageHeader,
  Stack,
  Tag,
} from '@hina-ui/react'
import { ArrowLeft, Ellipsis, Trash2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { Button, IconButton } from '~/shared/ui/button'
import { walkthroughsPath, type WalkthroughState } from '../walkthrough'
import type { GameRef } from '../walkthrough.use-cases'

const tones = {
  published: 'success',
  draft: 'neutral',
  reviewing: 'warning',
  hidden: 'danger',
} as const

type WritingHeaderProps = {
  game: GameRef
  state: WalkthroughState
  stored: boolean
  saving: boolean
  onSaveDraft: () => void
  onPublish: () => void
  onRemove: () => void
}

export function WritingHeader(props: WritingHeaderProps) {
  const { game, state, stored, saving, onSaveDraft, onPublish, onRemove } = props
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  return (
    <Stack gap="xs">
      <Link
        asChild
        tone="neutral"
        className="text-muted inline-flex items-center gap-1.5 self-start"
      >
        <RouterLink to={walkthroughsPath(locale, game.id)} prefetch="intent">
          <ArrowLeft aria-hidden className="size-4" />
          {gameTitle(game, locale)}
        </RouterLink>
      </Link>
      <PageHeader
        title={t('writeTitle')}
        actions={
          <Inline gap="sm" align="center" wrap={false}>
            <Tag tone={tones[state]}>{t(`state.${state}`)}</Tag>
            <DropdownMenu
              align="end"
              content={
                <DropdownMenuItem
                  icon={<Trash2 />}
                  tone="danger"
                  disabled={!stored}
                  onSelect={onRemove}
                >
                  {t('remove')}
                </DropdownMenuItem>
              }
            >
              <IconButton label={t('more')} variant="ghost" tone="neutral">
                <Ellipsis />
              </IconButton>
            </DropdownMenu>
            <SaveButtons
              state={state}
              saving={saving}
              onSaveDraft={onSaveDraft}
              onPublish={onPublish}
              className="max-md:hidden"
            />
          </Inline>
        }
      />
    </Stack>
  )
}

type SaveButtonsProps = Pick<
  WritingHeaderProps,
  'state' | 'saving' | 'onSaveDraft' | 'onPublish'
> & {
  block?: boolean
  className?: string
}

export function SaveButtons(props: SaveButtonsProps) {
  const { state, saving, onSaveDraft, onPublish, block = false, className } = props
  const t = useTranslations('walkthrough')
  const grow = block ? 'flex-1' : undefined
  return (
    <Inline gap="sm" align="center" wrap={false} className={className}>
      <Button
        variant="outline"
        tone="neutral"
        disabled={saving}
        className={grow}
        onClick={onSaveDraft}
      >
        {t(state === 'draft' ? 'saveDraft' : 'backToDraft')}
      </Button>
      <Button loading={saving} className={grow} onClick={onPublish}>
        {t('publish')}
      </Button>
    </Inline>
  )
}
