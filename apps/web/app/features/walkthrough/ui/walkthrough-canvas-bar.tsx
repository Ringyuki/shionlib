import { Inline, Text } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { Saving } from '../use-walkthrough-writing'

type WalkthroughCanvasBarProps = {
  back: string
  game: string
  characters: number
  status: string | undefined
  draft: boolean
  saving: Saving | undefined
  busy: boolean
  onSave: (publish: boolean) => void
}

export function WalkthroughCanvasBar({
  back,
  game,
  characters,
  status,
  draft,
  saving,
  busy,
  onSave,
}: WalkthroughCanvasBarProps) {
  const t = useTranslations('walkthrough')
  return (
    <Inline
      as="header"
      align="center"
      gap="sm"
      wrap={false}
      className="border-line bg-canvas sticky top-0 z-20 h-14 shrink-0 border-b px-2 sm:px-4"
    >
      <Button asChild iconOnly variant="ghost" tone="neutral" aria-label={t('back')}>
        <RouterLink to={back}>
          <ArrowLeft aria-hidden />
        </RouterLink>
      </Button>
      <Text size="sm" truncate className="min-w-0 flex-1 max-md:hidden">
        {game}
      </Text>
      <Text size="sm" tone="faint" className="shrink-0 tabular-nums max-md:hidden">
        {t('characters', { count: characters })}
      </Text>
      <Text size="sm" tone="faint" role="status" truncate className="min-w-0 max-md:flex-1 md:me-1">
        {status}
      </Text>
      <Button
        variant="outline"
        tone="neutral"
        loading={saving === 'draft'}
        disabled={busy || saving === 'publish'}
        onClick={() => onSave(false)}
      >
        {t(draft ? 'saveDraft' : 'backToDraft')}
      </Button>
      <Button
        loading={saving === 'publish'}
        disabled={busy || saving === 'draft'}
        onClick={() => onSave(true)}
      >
        {t(draft ? 'publish' : 'save')}
      </Button>
    </Inline>
  )
}
