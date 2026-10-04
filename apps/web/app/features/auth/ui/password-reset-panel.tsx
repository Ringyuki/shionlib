import {
  Button,
  Form,
  FormField,
  Heading,
  PasswordInput,
  Result,
  Stack,
  Text,
} from '@hina-ui/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { FailureAlert } from '~/shared/ui/failure-alert'
import { authViewParam, passwordResetIssues, type PasswordResetForm } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { usePasswordReset } from '../use-password-reset'

type PasswordResetPanelProps = {
  token: string
  email: string
  valid: boolean
}

export function PasswordResetPanel({ token, email, valid }: PasswordResetPanelProps) {
  const t = useTranslations('auth.reset')
  if (!valid) {
    return (
      <Result
        status="warning"
        title={t('invalid')}
        className="py-12"
        actions={
          <Button asChild variant="soft">
            <Link to={{ search: `?${authViewParam}=forgot-password` }}>{t('requestAgain')}</Link>
          </Button>
        }
      />
    )
  }
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-sm py-8">
      <Stack gap="xs">
        <Heading level={1} size="2xl" weight="semibold">
          {t('title')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('description', { email })}
        </Text>
      </Stack>
      <ResetForm token={token} email={email} />
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
      <Result
        status="success"
        title={t('done')}
        actions={
          <Button asChild>
            <Link to={{ search: `?${authViewParam}=sign-in` }}>{t('signIn')}</Link>
          </Button>
        }
      />
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
          <FailureAlert message={message} />
          <Button type="submit" loading={submitting} block>
            {t('submit')}
          </Button>
        </>
      )}
    </Form>
  )
}
