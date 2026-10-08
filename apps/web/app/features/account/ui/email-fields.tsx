import { FormField, Inline, Input, PinInput } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { codeLength } from '~/features/auth'
import { Button } from '~/shared/ui/button'
import type { SentCodes } from '../account'
import type { EmailValues } from '../account.schema'

type Sender = { cooldown: number; requesting: boolean }

type EmailFieldsProps = {
  current: string
  values: EmailValues
  onValuesChange: (values: EmailValues) => void
  codes: SentCodes
  currentSender: Sender
  newSender: Sender
  onSendCurrent: () => void
  onSendNew: () => void
}

export function EmailFields({
  current,
  values,
  onValuesChange,
  codes,
  currentSender,
  newSender,
  onSendCurrent,
  onSendNew,
}: EmailFieldsProps) {
  const t = useTranslations('account.email')
  const label = (sender: Sender) =>
    sender.cooldown > 0 ? t('resendIn', { seconds: sender.cooldown }) : t('sendCode')
  return (
    <>
      <FormField
        name="currentCode"
        label={t('currentCode')}
        description={t(codes.currentId === undefined ? 'currentCodeHint' : 'codeSent', {
          email: current,
        })}
        required
      >
        <Inline gap="sm" align="center">
          <PinInput
            value={values.currentCode}
            onValueChange={code => onValuesChange({ ...values, currentCode: code.toUpperCase() })}
            length={codeLength}
            otp
          />
          <Button
            variant="soft"
            loading={currentSender.requesting}
            disabled={currentSender.cooldown > 0}
            onClick={onSendCurrent}
          >
            {label(currentSender)}
          </Button>
        </Inline>
      </FormField>
      <FormField name="email" label={t('newEmail')} required>
        <Inline gap="sm" wrap={false}>
          <Input
            value={values.email}
            onValueChange={email => onValuesChange({ ...values, email })}
            type="email"
            autoComplete="email"
            className="min-w-0 flex-1"
          />
          <Button
            variant="soft"
            loading={newSender.requesting}
            disabled={newSender.cooldown > 0}
            onClick={onSendNew}
            className="shrink-0"
          >
            {label(newSender)}
          </Button>
        </Inline>
      </FormField>
      <FormField
        name="newCode"
        label={t('newCode')}
        description={
          codes.sentTo === undefined ? undefined : t('codeSent', { email: codes.sentTo })
        }
        required
      >
        <PinInput
          value={values.newCode}
          onValueChange={code => onValuesChange({ ...values, newCode: code.toUpperCase() })}
          length={codeLength}
          otp
        />
      </FormField>
    </>
  )
}
