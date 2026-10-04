import {
  Button,
  Callout,
  Form,
  FormField,
  Heading,
  PasswordInput,
  Stack,
  Text,
} from '@hina-ui/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { authViewParam, passwordResetIssues, type PasswordResetForm } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { usePasswordReset } from '../use-password-reset'
import { FailureCallout } from './failure-callout'

type PasswordResetPanelProps = {
  token: string
  email: string
  valid: boolean
}

export function PasswordResetPanel({ token, email, valid }: PasswordResetPanelProps) {
  const t = useTranslations('auth.reset')
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-sm py-8">
      <Stack gap="xs">
        <Heading level={1} size="2xl" weight="semibold">
          {t('title')}
        </Heading>
        {valid && (
          <Text size="sm" tone="muted">
            {t('description', { email })}
          </Text>
        )}
      </Stack>
      {valid ? (
        <ResetForm token={token} email={email} />
      ) : (
        <Stack gap="md">
          <Callout tone="warning" role="status">
            {t('invalid')}
          </Callout>
          <Button asChild variant="soft" block>
            <Link to={{ search: `?${authViewParam}=forgot-password` }}>{t('requestAgain')}</Link>
          </Button>
        </Stack>
      )}
    </Stack>
  )
}

function ResetForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations('auth.reset')
  const [values, setValues] = useState<PasswordResetForm>({ password: '', confirmation: '' })
  const reset = usePasswordReset()
  const { form, explain, message } = useFormFeedback(reset.failure)

  if (reset.done) {
    return (
      <Stack gap="md">
        <Callout tone="success" role="status">
          {t('done')}
        </Callout>
        <Button asChild block>
          <Link to={{ search: `?${authViewParam}=sign-in` }}>{t('signIn')}</Link>
        </Button>
      </Stack>
    )
  }

  return (
    <Form
      ref={form}
      values={values}
      rules={() => explain(passwordResetIssues(values))}
      onSubmit={() => reset.submit({ token, email, password: values.password })}
    >
      {({ submitting }) => (
        <>
          <FormField name="password" label={t('password')} required>
            <PasswordInput
              value={values.password}
              onValueChange={password => setValues({ ...values, password })}
              autoComplete="new-password"
              autoFocus
            />
          </FormField>
          <FormField name="confirmation" label={t('confirmation')} required>
            <PasswordInput
              value={values.confirmation}
              onValueChange={confirmation => setValues({ ...values, confirmation })}
              autoComplete="new-password"
            />
          </FormField>
          <FailureCallout message={message} />
          <Button type="submit" loading={submitting} block>
            {t('submit')}
          </Button>
        </>
      )}
    </Form>
  )
}
