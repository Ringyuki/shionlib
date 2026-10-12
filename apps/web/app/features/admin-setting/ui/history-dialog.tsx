import { Dialog, Empty, Inline, Spinner, Stack, Text, Time, Timeline } from '@hina-ui/react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useLast } from '~/shared/ui/use-last'
import type { Change, Setting } from '../admin-setting'
import { useShownValue } from './use-shown-value'

type HistoryDialogProps = {
  setting: Setting | undefined
  changes: Change[] | undefined
  loading: boolean
  onClose: () => void
}

function Entry({ setting, change }: { setting: Setting; change: Change }) {
  const t = useTranslations('adminSetting')
  const shown = useShownValue()
  const before = change.previous ?? setting.fallback
  const after = change.value ?? setting.fallback
  return (
    <Stack gap="xs" className="pb-2">
      <Inline gap="sm" align="center">
        <Text as="span" size="sm" weight="medium">
          {change.editor ?? t('system')}
        </Text>
        <Time value={change.at} className="text-muted text-sm" />
        {change.value === undefined && (
          <Text as="span" size="sm" tone="muted">
            {t('restore')}
          </Text>
        )}
      </Inline>
      <Inline gap="sm" align="center" className="tabular-nums">
        <Text as="span" size="sm" tone="muted" className="break-all line-through">
          {shown(setting.kind, before)}
        </Text>
        <ArrowRight aria-hidden className="text-muted size-3.5 shrink-0" />
        <Text as="span" size="sm" className="break-all">
          {shown(setting.kind, after)}
        </Text>
      </Inline>
    </Stack>
  )
}

export function HistoryDialog({ setting, changes, loading, onClose }: HistoryDialogProps) {
  const t = useTranslations('adminSetting')
  const shown = useLast(setting)
  return (
    <Dialog
      title={t('history.title')}
      description={
        shown === undefined
          ? undefined
          : t('history.subject', { label: shown.label, name: shown.name })
      }
      open={setting !== undefined}
      onOpenChange={open => {
        if (!open) {
          onClose()
        }
      }}
      renderContent={() => {
        if (shown === undefined || changes === undefined || loading) {
          return (
            <Inline justify="center" className="py-6">
              <Spinner label={t('history.loading')} />
            </Inline>
          )
        }
        if (changes.length === 0) {
          return <Empty size="sm" title={t('history.empty')} />
        }
        return (
          <Timeline
            size="sm"
            items={changes.map(change => ({ id: change.id, change }))}
            renderContent={({ item }) => <Entry setting={shown} change={item.change} />}
          />
        )
      }}
    />
  )
}
