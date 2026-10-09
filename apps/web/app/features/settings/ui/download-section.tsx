import { Panel } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  Aria2Fields,
  ManagerSwitches,
  MethodChoice,
  useDownloadSettings,
} from '~/features/download'

export function DownloadSection() {
  const t = useTranslations('download.preferences')
  const settings = useDownloadSettings()
  return (
    <>
      <Panel title={t('method')} description={t('local')}>
        <MethodChoice settings={settings} />
      </Panel>
      <Panel title={t('managers')} description={t('managersHint')}>
        <ManagerSwitches settings={settings} />
      </Panel>
      <Panel title={t('aria2')} description={t('aria2Hint')}>
        <Aria2Fields settings={settings} />
      </Panel>
    </>
  )
}
