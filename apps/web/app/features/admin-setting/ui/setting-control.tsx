import { Inline, Input, NumberInput, PasswordInput, Select, Switch, Textarea } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { fittingUnit, hiddenValue, unitsOf, type Setting, type Value } from '../admin-setting'

type SettingControlProps = {
  setting: Setting
  value: Value
  disabled: boolean
  invalid: boolean
  onChange: (value: Value) => void
}

const longText = 80

function Amount({
  setting,
  value,
  disabled,
  invalid,
  onChange,
}: SettingControlProps & { value: number }) {
  const t = useTranslations('adminSetting.unit')
  const units = unitsOf(setting.kind) ?? []
  const [chosen, setChosen] = useState<string>(() => fittingUnit(units, value).unit)
  const unit = units.find(known => known.unit === chosen) ?? fittingUnit(units, value)
  return (
    <Inline gap="xs" align="center" wrap={false}>
      <NumberInput
        aria-label={setting.label}
        className="w-28"
        controls={false}
        stepSnapping={false}
        disabled={disabled}
        invalid={invalid}
        min={0}
        value={value / unit.size}
        formatOptions={{ maximumFractionDigits: 4 }}
        onValueChange={amount => onChange((amount ?? Number.NaN) * unit.size)}
      />
      <Select
        aria-label={t('label', { name: setting.label })}
        className="w-24"
        disabled={disabled}
        value={unit.unit}
        options={units.map(known => ({ value: known.unit, label: t(known.unit) }))}
        onValueChange={next => {
          const wanted = units.find(known => known.unit === next)
          if (wanted !== undefined) {
            setChosen(wanted.unit)
            onChange((value / unit.size) * wanted.size)
          }
        }}
      />
    </Inline>
  )
}

function Secret({
  setting,
  value,
  disabled,
  invalid,
  onChange,
}: SettingControlProps & { value: string }) {
  const t = useTranslations('adminSetting.secret')
  const kept = setting.value === hiddenValue
  return (
    <PasswordInput
      aria-label={setting.label}
      className="w-64 max-w-full"
      autoComplete="off"
      disabled={disabled}
      invalid={invalid}
      placeholder={t(kept ? 'replace' : 'enter')}
      value={value === hiddenValue ? '' : value}
      onValueChange={typed => onChange(typed === '' ? setting.value : typed)}
    />
  )
}

export function SettingControl(props: SettingControlProps) {
  const { setting, value, disabled, invalid, onChange } = props
  if (typeof value === 'boolean') {
    return (
      <Switch
        aria-label={setting.label}
        checked={value}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    )
  }
  if (setting.kind === 'secret' && typeof value === 'string') {
    return <Secret {...props} value={value} />
  }
  if (typeof value === 'string') {
    return (setting.maxLength ?? 0) > longText ? (
      <Textarea
        aria-label={setting.label}
        className="w-80 max-w-full"
        disabled={disabled}
        invalid={invalid}
        value={value}
        autosize={{ minRows: 2, maxRows: 6 }}
        onValueChange={onChange}
      />
    ) : (
      <Input
        aria-label={setting.label}
        className="w-64 max-w-full"
        disabled={disabled}
        invalid={invalid}
        value={value}
        onValueChange={onChange}
      />
    )
  }
  if (unitsOf(setting.kind) !== undefined) {
    return <Amount {...props} value={value} />
  }
  return (
    <NumberInput
      aria-label={setting.label}
      className="w-28"
      controls={false}
      stepSnapping={false}
      disabled={disabled}
      invalid={invalid}
      value={value}
      formatOptions={{ maximumFractionDigits: setting.kind === 'float' ? 4 : 0 }}
      onValueChange={next => onChange(next ?? Number.NaN)}
    />
  )
}
