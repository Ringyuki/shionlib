import { Alert, Form, FormField, Inline, Input, PasswordInput, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import {
  aria2Form,
  defaultAria2Endpoint,
  storeDownloadSettings,
  type Aria2Values,
  type DownloadSettings,
} from '~/features/download'
import { Button } from '~/shared/ui/button'
import { useAria2Check } from '../use-aria2-check'

export function Aria2Form({ settings }: { settings: DownloadSettings }) {
  const t = useTranslations('settings.download')
  const issue = useTranslations('settings.issue')
  const [values, setValues] = useState<Aria2Values>(settings.aria2)
  const { check, checking, reach, forget } = useAria2Check()
  const change = (patch: Partial<Aria2Values>) => {
    forget()
    setValues({ ...values, ...patch })
  }
  return (
    <Form
      values={values}
      rules={aria2Form(issue)}
      onSubmit={() => {
        storeDownloadSettings({ ...settings, aria2: values })
        toast.success(t('saved'))
      }}
    >
      <FormField name="endpoint" label={t('endpoint')} description={t('endpointHint')} required>
        <Input
          value={values.endpoint}
          onValueChange={endpoint => change({ endpoint })}
          placeholder={defaultAria2Endpoint}
          inputMode="url"
        />
      </FormField>
      <FormField name="secret" label={t('secret')} description={t('secretHint')}>
        <PasswordInput
          value={values.secret}
          onValueChange={secret => change({ secret })}
          autoComplete="off"
        />
      </FormField>
      <FormField name="directory" label={t('directory')} description={t('directoryHint')}>
        <Input value={values.directory} onValueChange={directory => change({ directory })} />
      </FormField>
      <Alert tone={reach?.ok === true ? 'success' : 'danger'} open={reach !== undefined}>
        {reach?.ok === true
          ? t('reachable', { version: reach.version })
          : t(`unreachable.${reach?.reason ?? 'unreachable'}`, { message: reach?.message ?? '' })}
      </Alert>
      <Inline gap="sm" justify="end">
        <Button
          variant="outline"
          tone="neutral"
          loading={checking}
          onClick={() => void check(values)}
        >
          {t('test')}
        </Button>
        <Button type="submit">{t('save')}</Button>
      </Inline>
    </Form>
  )
}
