import { Button } from '@/components/shionui/Button'
import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { Aria2Settings } from '@/interfaces/aria2/aria2.interface'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { initialSettings, useAria2Store, useAria2TestStore } from '@/store/localSettingsStore'

interface Aria2ResetProps {
  form: UseFormReturn<Aria2Settings>
}

export const Aria2Reset = ({ form }: Aria2ResetProps) => {
  const t = useTranslations('Components.User.Settings.Aria2.Reset')
  const { setSettings } = useAria2Store()
  const { setTestStatus, setTestMessage } = useAria2TestStore()
  const onReset = () => {
    form.reset(initialSettings)
    setSettings({
      protocol: initialSettings.protocol,
      host: initialSettings.host,
      port: initialSettings.port,
      path: initialSettings.path,
      auth_secret: initialSettings.auth_secret,
      downloadPath: initialSettings.downloadPath,
    })
    setTestStatus('idle')
    setTestMessage('')
    // toast.success(t('success'))
    sileo.success({ title: t('success') })
  }

  return (
    <Button intent="neutral" appearance="soft" onClick={onReset} renderIcon={<RotateCcw />}>
      {t('reset')}
    </Button>
  )
}
