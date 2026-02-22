import { Button } from '@/components/shionui/Button'
import { FlaskConical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { Aria2Settings } from '@/interfaces/aria2/aria2.interface'
import { check } from '@/components/game/download/helpers/aria2'
import { useAria2TestStore } from '@/store/localSettingsStore'
import { sileo } from 'sileo'

interface Aria2TestProps {
  form: UseFormReturn<Aria2Settings>
}

export const Aria2Test = ({ form }: Aria2TestProps) => {
  const t = useTranslations('Components.User.Settings.Aria2.Test')
  const { testStatus, setTestStatus } = useAria2TestStore()

  const onTest = async () => {
    const values = form.getValues()
    setTestStatus('testing')
    try {
      const result = await check(
        values.protocol,
        values.host,
        values.port,
        values.path,
        values.auth_secret,
      )
      if (result === true) {
        setTestStatus('success')
        sileo.success({ title: t('success') })
      } else {
        setTestStatus('error')
        if (result.details === 'aria2FailedToFetch') {
          sileo.error({ title: t('failedToConnect') })
        } else if (result.details?.message === 'Unauthorized') {
          sileo.error({ title: t('unauthorized') })
        } else {
          sileo.error({ title: t('failed') })
        }
      }
    } catch (error) {
      setTestStatus('error')
      sileo.error({ title: t('failed') })
    }
  }
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Button
        intent="secondary"
        appearance="outline"
        onClick={onTest}
        loading={testStatus === 'testing'}
        renderIcon={<FlaskConical />}
        data-testid="settings-aria2-test"
      >
        {t('title')}
      </Button>
    </div>
  )
}
