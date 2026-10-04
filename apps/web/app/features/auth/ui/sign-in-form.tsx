import { Button, Form, FormField, Inline, Input, PasswordInput, Text } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { signInIssues, type AuthView, type SignIn } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { useSignIn } from '../use-sign-in'
import { FailureCallout } from './failure-callout'
import { SignInMethods } from './sign-in-methods'

export function SignInForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const t = useTranslations('auth.sign-in')
  const [values, setValues] = useState<SignIn>({ identifier: '', password: '' })
  const { submit, failure } = useSignIn()
  const { form, explain, message } = useFormFeedback(failure)

  return (
    <Form
      ref={form}
      values={values}
      rules={() => explain(signInIssues(values))}
      onSubmit={() => submit(values)}
    >
      {({ submitting }) => (
        <>
          <FormField name="identifier" label={t('identifier')} required>
            <Input
              value={values.identifier}
              onValueChange={identifier => setValues({ ...values, identifier })}
              autoComplete="username"
              autoFocus
            />
          </FormField>
          <FormField name="password" label={t('password')} required>
            <PasswordInput
              value={values.password}
              onValueChange={password => setValues({ ...values, password })}
              autoComplete="current-password"
            />
          </FormField>
          <Inline justify="end" className="-mt-2">
            <Button variant="link" size="sm" onClick={() => onSwitch('forgot-password')}>
              {t('forgot')}
            </Button>
          </Inline>
          <FailureCallout message={message} />
          <Button type="submit" loading={submitting} block>
            {t('submit')}
          </Button>
          <SignInMethods />
          <Inline gap="xs" justify="center" align="center">
            <Text size="sm" tone="muted">
              {t('noAccount')}
            </Text>
            <Button variant="link" size="sm" onClick={() => onSwitch('sign-up')}>
              {t('toSignUp')}
            </Button>
          </Inline>
        </>
      )}
    </Form>
  )
}
