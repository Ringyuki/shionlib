import { Button } from '@/components/shionui/Button'
import { FlaskConical } from 'lucide-react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { Aria2Settings } from '@/interfaces/aria2/aria2.interface'
import { check } from '@/components/game/download/helpers/aria2'
import { useAria2TestStore } from '@/store/localSettingsStore'

interface Aria2TestProps {
  form: UseFormReturn<Aria2Settings>
}

export const Aria2Test = ({ form }: Aria2TestProps) => {
  const t = useTranslations('Components.User.Settings.Aria2.Test')
  const { testStatus, testMessage, setTestStatus, setTestMessage } = useAria2TestStore()

  const onTest = async () => {
    const values = form.getValues()
    setTestStatus('testing')
    setTestMessage('')
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
        setTestMessage(t('success'))
      } else {
        setTestStatus('error')
        if (result.details === 'aria2FailedToFetch') {
          setTestMessage(t('failedToConnect'))
        } else if (result.details?.message === 'Unauthorized') {
          setTestMessage(t('unauthorized'))
        } else {
          setTestMessage(t('failed'))
        }
      }
    } catch (error) {
      setTestStatus('error')
      setTestMessage(t('failed'))
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
      >
        {t('title')}
      </Button>
      {testStatus !== 'idle' && testStatus !== 'testing' && (
        <div className="flex items-center gap-2 text-sm">
          {testStatus === 'success' ? (
            <>
              <CheckCircle2 className="size-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">{testMessage}</span>
            </>
          ) : (
            <>
              <XCircle className="size-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">{testMessage}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
