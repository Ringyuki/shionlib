import {
  Alert,
  Anchor,
  Empty,
  Grid,
  PageHeader,
  Panel,
  SearchInput,
  Stack,
  Text,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { isSuperAdmin, type Viewer } from '~/features/viewer'
import { SideColumn } from '~/shared/ui/side-column'
import { matching, sectioned, shownValue, type Setting } from '../admin-setting'
import { useSettingDrafts } from '../use-setting-drafts'
import { useSettingHistory } from '../use-setting-history'
import { HistoryDialog } from './history-dialog'
import { LeaveDialog } from './leave-dialog'
import { SettingRow } from './setting-row'
import { UnsavedBar } from './unsaved-bar'

type SettingsPageProps = {
  settings: Setting[]
  viewer: Viewer | null
}

const sectionId = (key: string) => `settings-${key}`

export function SettingsPage({ settings, viewer }: SettingsPageProps) {
  const t = useTranslations('adminSetting')
  const editable = isSuperAdmin(viewer)
  const [query, setQuery] = useState('')
  const [inspected, setInspected] = useState<Setting>()
  const drafts = useSettingDrafts(settings)
  const history = useSettingHistory()
  const shown = sectioned(matching(settings, query))
  return (
    <Stack gap="lg" className="min-h-full flex-1">
      <PageHeader
        title={t('title')}
        actions={
          <SearchInput
            aria-label={t('search')}
            placeholder={t('search')}
            className="w-60 max-sm:w-full"
            value={query}
            onValueChange={setQuery}
          />
        }
      />
      <Alert tone="info" open={!editable}>
        {t('readOnly')}
      </Alert>
      {shown.length === 0 ? (
        <Empty title={t('noMatch')} />
      ) : (
        <Grid gap="none" className="items-start gap-8 lg:grid-cols-[minmax(0,1fr)_10.5rem]">
          <Stack gap="lg" className="min-w-0">
            {shown.map(section => (
              <Panel
                key={section.key}
                id={sectionId(section.key)}
                title={t(`section.${section.key}`)}
                count={section.settings.length}
                padded={false}
                className="scroll-mt-4"
              >
                <Stack gap="none" className="divide-line border-line divide-y border-t">
                  {section.settings.map(setting => (
                    <SettingRow
                      key={setting.name}
                      setting={setting}
                      value={shownValue(setting, drafts.draft)}
                      editable={editable}
                      onChange={value => drafts.change(setting, value)}
                      onHistory={() => {
                        setInspected(setting)
                        history.load(setting.name)
                      }}
                    />
                  ))}
                </Stack>
              </Panel>
            ))}
          </Stack>
          <SideColumn className="max-lg:hidden">
            <Anchor
              label={t('sections')}
              items={shown.map(section => ({
                id: sectionId(section.key),
                label: t(`section.${section.key}`),
                count: section.settings.length,
              }))}
              renderTrailing={({ item }) => (
                <Text as="span" size="sm" tone="faint" className="ms-auto tabular-nums">
                  {item.count}
                </Text>
              )}
            />
          </SideColumn>
        </Grid>
      )}
      <UnsavedBar
        drafts={drafts}
        onSave={async () => {
          if (await drafts.save()) {
            toast.success(t('saved'))
          }
        }}
      />
      <LeaveDialog guard={drafts.guard} />
      <HistoryDialog
        setting={inspected}
        changes={history.changes}
        loading={history.loading}
        onClose={() => setInspected(undefined)}
      />
    </Stack>
  )
}
