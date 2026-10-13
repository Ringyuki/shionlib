import { Affix, Indicator, Inline, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { SettingDrafts } from '../use-setting-drafts'

type UnsavedBarProps = {
  drafts: SettingDrafts
  onSave: () => void
}

export function UnsavedBar({ drafts, onSave }: UnsavedBarProps) {
  const t = useTranslations('adminSetting')
  const format = useFormatter()
  if (drafts.changed.length === 0) {
    return null
  }
  return (
    <Affix
      position="bottom"
      className="bg-canvas border-line -mx-4 mt-auto border-t px-4 py-3 sm:-mx-6 sm:px-6"
    >
      <Inline gap="md" align="center">
        <Inline gap="sm" align="center" className="min-w-0 flex-1">
          <Indicator tone="warning" size="sm" />
          <Text as="span" weight="medium">
            {t('unsavedCount', { count: drafts.changed.length })}
          </Text>
          <Text as="span" size="sm" tone="muted" truncate>
            {format.list(
              drafts.changed.map(setting => setting.label),
              { type: 'conjunction', style: 'narrow' },
            )}
          </Text>
        </Inline>
        <Button variant="outline" tone="neutral" disabled={drafts.saving} onClick={drafts.discard}>
          {t('discard')}
        </Button>
        <Button loading={drafts.saving} disabled={drafts.blocked} onClick={onSave}>
          {t('save')}
        </Button>
      </Inline>
    </Affix>
  )
}
