import { Grid, Inline, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { EditorToolbar, type EditorHandle } from '~/shared/editor'
import { Button } from '~/shared/ui/button'
import { toolsClip, toolsInset, toolsReveal } from './composer-field'

type ComposerToolsProps = {
  handle: EditorHandle
  submitLabel: string
  pending: boolean
  idle: boolean
  collapsible: boolean
  shown: boolean
  onCancel: () => void
}

export function ComposerTools({
  handle,
  submitLabel,
  pending,
  idle,
  collapsible,
  shown,
  onCancel,
}: ComposerToolsProps) {
  const t = useTranslations('comment')
  return (
    <Grid gap="none" inert={!shown} className={toolsReveal(shown)}>
      <Stack gap="none" className={toolsClip}>
        <Inline justify="between" align="center" wrap={false} className={toolsInset(collapsible)}>
          <EditorToolbar handle={handle} />
          <Inline gap="none" align="center" wrap={false} className="gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              tone="neutral"
              disabled={pending}
              className="text-muted h-8 px-3"
              onClick={onCancel}
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              type="submit"
              loading={pending}
              disabled={idle}
              className="h-8 px-3.5"
            >
              {submitLabel}
            </Button>
          </Inline>
        </Inline>
      </Stack>
    </Grid>
  )
}
