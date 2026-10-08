import { Panel, RadioGroup } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  downloadMethodFrom,
  downloadMethods,
  storeDownloadSettings,
  useDownloadSettings,
} from '~/features/download'
import { Aria2Form } from './aria2-form'

export function DownloadSection() {
  const t = useTranslations('settings.download')
  const settings = useDownloadSettings()
  return (
    <>
      <Panel title={t('method')} description={t('local')}>
        <RadioGroup
          aria-label={t('method')}
          value={settings.method}
          onValueChange={value => {
            const method = downloadMethodFrom(value)
            if (method !== undefined) {
              storeDownloadSettings({ ...settings, method })
            }
          }}
          options={downloadMethods.map(method => ({
            value: method,
            label: t(`methods.${method}.label`),
            description: t(`methods.${method}.description`),
          }))}
        />
      </Panel>
      <Panel title={t('aria2')} description={t('aria2Hint')}>
        <Aria2Form key={JSON.stringify(settings.aria2)} settings={settings} />
      </Panel>
    </>
  )
}
