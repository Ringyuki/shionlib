import { Alert, Button, Form, FormField, Input } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { emailIssues, type AuthView, type EmailOnly } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { usePasswordResetRequest } from '../use-password-reset-request'

export function ForgotPasswordForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const t = useTranslations('auth.forgot-password')
  const [values, setValues] = useState<EmailOnly>({ email: '' })
  const request = usePasswordResetRequest()
  const { form, explain, message } = useFormFeedback(request.failure)

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
          <Alert tone="success" open={request.done}>
            {t('sent')}
          </Alert>
          <Alert tone="danger" open={message !== undefined}>
            {message}
          </Alert>
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
