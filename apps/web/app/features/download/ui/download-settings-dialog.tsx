import { Dialog, FormLayout, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useDownloadSettings } from '../use-download-settings'
import { Aria2Fields, ManagerSwitches, MethodChoice } from './download-preferences'

type DownloadSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DownloadSettingsDialog({ open, onOpenChange }: DownloadSettingsDialogProps) {
  const t = useTranslations('download.preferences')
  const settings = useDownloadSettings()
  return (
    <Dialog
      title={t('title')}
      description={t('local')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Stack gap="xl">
          <FormLayout legend={t('method')}>
            <MethodChoice settings={settings} />
          </FormLayout>
          <FormLayout legend={t('managers')} description={t('managersHint')}>
            <ManagerSwitches settings={settings} />
          </FormLayout>
          <FormLayout legend={t('aria2')} description={t('aria2Hint')}>
            <Aria2Fields settings={settings} />
          </FormLayout>
        </Stack>
      )}
      renderFooter={({ close }) => <Button onClick={close}>{t('done')}</Button>}
    />
  )
}
