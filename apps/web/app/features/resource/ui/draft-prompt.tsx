import { Card, Dialog, Inline, Stack, Text } from '@hina-ui/react'
import { FileArchive } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { useBytes } from '~/shared/i18n/use-bytes'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { Composition } from '../resource-composition'
import { resumeSearch } from '../resource-composition-draft'
import { useDiscardTime } from '../use-discard-time'

type DraftPromptProps = {
  drafts: Composition[]
  asking: boolean
}

export function DraftPrompt({ drafts, asking }: DraftPromptProps) {
  const t = useTranslations('resource.composition')
  const locale = useLocale()
  const [dismissed, setDismissed] = useState(false)
  const open = asking && !dismissed && drafts.length > 0
  const [shown] = useOpenState(open, () => drafts)
  const [only] = shown.length === 1 ? shown : []
  const resume = (draft: Composition) => `${sitePaths(locale).upload}${resumeSearch(draft)}`
  return (
    <Dialog
      title={t('draftPrompt.title')}
      open={open}
      onOpenChange={next => setDismissed(!next)}
      renderContent={() => (
        <Stack gap="sm">
          {shown.map(draft => (
            <Card key={draft.id}>
              <DraftSummary draft={draft} />
              {only === undefined && (
                <Inline justify="end" className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <RouterLink to={resume(draft)}>{t('continue')}</RouterLink>
                  </Button>
                </Inline>
              )}
            </Card>
          ))}
        </Stack>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="outline" onClick={close}>
            {t('draftPrompt.new')}
          </Button>
          {only !== undefined && (
            <Button asChild>
              <RouterLink to={resume(only)}>{t('continue')}</RouterLink>
            </Button>
          )}
        </>
      )}
    />
  )
}

function DraftSummary({ draft }: { draft: Composition }) {
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  const discardTime = useDiscardTime()
  const patch = draft.patch
  return (
    <Stack gap="xs">
      <Inline gap="sm" align="start" wrap={false}>
        <FileArchive aria-hidden className="mt-1 size-4 shrink-0 text-muted" />
        <Text weight="medium" className="min-w-0 break-words">
          {draft.file_name === '' ? (patch?.name ?? draft.base.name) : draft.file_name}
        </Text>
      </Inline>
      <Stack gap="none" className="ps-6">
        <Text size="sm" tone="muted" className="break-words">
          {t('draftPrompt.base', { name: draft.base.name })}
        </Text>
        {patch !== null && (
          <Text size="sm" tone="muted" className="break-words">
            {t('draftPrompt.patch', { name: patch.name, size: bytes(patch.size) })}
          </Text>
        )}
        <Text size="sm" tone="muted">
          {t('discardAt', { time: discardTime(draft) })}
        </Text>
      </Stack>
    </Stack>
  )
}
