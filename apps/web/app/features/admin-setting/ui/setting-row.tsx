import { Flex, Inline, Stack, Tag, Text, Tooltip } from '@hina-ui/react'
import { History } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { hiddenValue, problemOf, type Setting, type Value } from '../admin-setting'
import { SettingControl } from './setting-control'
import { useShownValue } from './use-shown-value'

type SettingRowProps = {
  setting: Setting
  value: Value
  editable: boolean
  onChange: (value: Value) => void
  onHistory: () => void
}

type SecretStateProps = Pick<SettingRowProps, 'setting' | 'value' | 'editable' | 'onChange'>

function SecretState({ setting, value, editable, onChange }: SecretStateProps) {
  const t = useTranslations('adminSetting.secret')
  if (setting.value !== hiddenValue) {
    return (
      <Text as="span" size="sm" tone="muted">
        {t('unset')}
      </Text>
    )
  }
  return (
    <>
      <Tag tone="success">{t('set')}</Tag>
      <Button
        size="sm"
        variant="link"
        disabled={!editable || value === ''}
        onClick={() => onChange('')}
      >
        {t('clear')}
      </Button>
    </>
  )
}

export function SettingRow({ setting, value, editable, onChange, onHistory }: SettingRowProps) {
  const t = useTranslations('adminSetting')
  const format = useFormatter()
  const shown = useShownValue()
  const unsaved = value !== setting.value
  const problem = problemOf(setting, value)
  const last = setting.lastChange
  return (
    <Flex
      role="group"
      aria-label={setting.label}
      className="flex-col gap-3 px-(--hn-panel-p) py-3.5 md:flex-row md:items-start md:gap-6"
    >
      <Stack gap="xs" className="min-w-0 flex-1">
        <Text as="span" weight="medium">
          {setting.label}
        </Text>
        {setting.description !== '' && (
          <Text as="span" size="sm" tone="muted" className="max-w-xl">
            {setting.description}
          </Text>
        )}
      </Stack>
      <Stack gap="xs" className="shrink-0 md:items-end">
        <Inline gap="xs" align="center" wrap={false}>
          <SettingControl
            setting={setting}
            value={value}
            disabled={!editable}
            invalid={problem !== undefined}
            onChange={onChange}
          />
          <Tooltip content={t('history.open')}>
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              tone="neutral"
              aria-label={t('history.of', { name: setting.label })}
              onClick={onHistory}
            >
              <History />
            </Button>
          </Tooltip>
        </Inline>
        {problem !== undefined && (
          <Text as="span" size="sm" tone="danger">
            {t(`problem.${problem.kind}`, {
              bound: 'bound' in problem ? shown(setting.kind, problem.bound) : '',
            })}
          </Text>
        )}
        <Inline gap="sm" align="center" className="md:justify-end">
          {setting.kind === 'secret' ? (
            <SecretState setting={setting} value={value} editable={editable} onChange={onChange} />
          ) : (
            <Text as="span" size="sm" tone="muted">
              {setting.fallback === ''
                ? t('fallbackBlank')
                : t('fallback', { value: shown(setting.kind, setting.fallback) })}
            </Text>
          )}
          {unsaved && <Tag tone="warning">{t('unsaved')}</Tag>}
          {!unsaved && setting.overridden && setting.kind !== 'secret' && (
            <>
              <Tag tone="accent">{t('overridden')}</Tag>
              {last !== undefined && (
                <Text as="span" size="sm" tone="muted">
                  {t('lastChange', {
                    editor: last.editor ?? t('system'),
                    date: format.dateTime(new Date(last.at), { month: 'short', day: 'numeric' }),
                  })}
                </Text>
              )}
              <Button
                size="sm"
                variant="link"
                disabled={!editable}
                onClick={() => onChange(setting.fallback)}
              >
                {t('restore')}
              </Button>
            </>
          )}
        </Inline>
      </Stack>
    </Flex>
  )
}
