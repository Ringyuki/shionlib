import {
  Alert,
  Form,
  FormField,
  Inline,
  Input,
  Link,
  PasswordInput,
  RadioGroup,
  Stack,
  Switch,
  Text,
} from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { managerNames, managers, managerSites } from '~/shared/vendor/managers'
import {
  defaultAria2Endpoint,
  offeredMethods,
  withManagerShown,
  type DownloadSettings,
} from '../download'
import { aria2Form, downloadMethodFrom } from '../download.schema'
import { useAria2Check } from '../use-aria2-check'
import { useAria2Settings } from '../use-aria2-settings'
import { storeDownloadSettings } from '../use-download-settings'
import { ManagerLogo } from './manager-logo'

type PreferenceProps = { settings: DownloadSettings }

export function MethodChoice({ settings }: PreferenceProps) {
  const t = useTranslations('download.preferences')
  return (
    <RadioGroup
      aria-label={t('method')}
      value={settings.method}
      onValueChange={value => {
        const method = downloadMethodFrom(value)
        if (method !== undefined) {
          storeDownloadSettings({ ...settings, method })
        }
      }}
      options={offeredMethods(settings).map(method => ({
        value: method,
        label: t(`methods.${method}.label`),
        description: t(`methods.${method}.description`),
      }))}
    />
  )
}

export function ManagerSwitches({ settings }: PreferenceProps) {
  const t = useTranslations('download.preferences')
  return (
    <Stack gap="md">
      {managers.map(manager => {
        const name = managerNames[manager]
        return (
          <Inline key={manager} gap="md" align="start" justify="between" wrap={false}>
            <Inline gap="sm" align="start" wrap={false} className="min-w-0">
              <ManagerLogo manager={manager} className="size-9" />
              <Stack gap="none" className="min-w-0">
                <Link
                  href={managerSites[manager]}
                  target="_blank"
                  rel="noreferrer"
                  tone="neutral"
                  className="w-fit font-medium"
                >
                  <Inline as="span" gap="xs" align="center" wrap={false}>
                    {name}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </Inline>
                </Link>
                <Text size="sm" tone="muted">
                  {t(`manager.${manager}`)}
                </Text>
              </Stack>
            </Inline>
            <Switch
              checked={settings.managers[manager]}
              onCheckedChange={shown =>
                storeDownloadSettings(withManagerShown(settings, manager, shown))
              }
              aria-label={t('showManager', { name })}
            />
          </Inline>
        )
      })}
    </Stack>
  )
}

export function Aria2Fields({ settings }: PreferenceProps) {
  const t = useTranslations('download.preferences')
  const issue = useTranslations('download.preferences.issue')
  const { values, change } = useAria2Settings(settings)
  const { check, checking, reach, forget } = useAria2Check()
  const edit = (patch: Partial<typeof values>) => {
    forget()
    change(patch)
  }
  return (
    <Form values={values} rules={aria2Form(issue)} validateOn="change">
      <FormField name="endpoint" label={t('endpoint')} description={t('endpointHint')} required>
        <Input
          value={values.endpoint}
          onValueChange={endpoint => edit({ endpoint })}
          placeholder={defaultAria2Endpoint}
          inputMode="url"
        />
      </FormField>
      <FormField name="secret" label={t('secret')} description={t('secretHint')}>
        <PasswordInput
          value={values.secret}
          onValueChange={secret => edit({ secret })}
          autoComplete="off"
        />
      </FormField>
      <FormField name="directory" label={t('directory')} description={t('directoryHint')}>
        <Input value={values.directory} onValueChange={directory => edit({ directory })} />
      </FormField>
      <Alert tone={reach?.ok === true ? 'success' : 'danger'} open={reach !== undefined}>
        {reach?.ok === true
          ? t('reachable', { version: reach.version })
          : t(`unreachable.${reach?.reason ?? 'unreachable'}`, { message: reach?.message ?? '' })}
      </Alert>
      <Inline justify="end">
        <Button
          variant="outline"
          tone="neutral"
          loading={checking}
          onClick={() => void check(values)}
        >
          {t('test')}
        </Button>
      </Inline>
    </Form>
  )
}
