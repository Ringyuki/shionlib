import { Button, Callout, Form, FormField, Input, Stack } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { emailIssues, type AuthView, type EmailOnly } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { usePasswordResetRequest } from '../use-password-reset-request'
import { FailureCallout } from './failure-callout'

export function ForgotPasswordForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const t = useTranslations('auth.forgot-password')
  const [values, setValues] = useState<EmailOnly>({ email: '' })
  const request = usePasswordResetRequest()
  const { form, explain, message } = useFormFeedback(request.failure)

  if (request.done) {
    return (
      <Stack gap="md">
        <Callout tone="success" role="status">
          {t('sent')}
        </Callout>
        <Button variant="soft" onClick={() => onSwitch('sign-in')} block>
          {t('back')}
        </Button>
      </Stack>
    )
  }

  return (
    <Form
      ref={form}
      values={values}
      rules={() => explain(emailIssues(values))}
      onSubmit={() => request.submit(values)}
    >
      {({ submitting }) => (
        <>
          <FormField name="email" label={t('email')} required>
            <Input
              value={values.email}
              onValueChange={email => setValues({ email })}
              type="email"
              autoComplete="email"
              autoFocus
            />
          </FormField>
          <FailureCallout message={message} />
          <Button type="submit" loading={submitting} block>
            {t('submit')}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => onSwitch('sign-in')}
            className="self-center"
          >
            {t('back')}
          </Button>
        </>
      )}
    </Form>
  )
}
