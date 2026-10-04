import {
  Button,
  Checkbox,
  Form,
  FormField,
  Inline,
  Input,
  PasswordInput,
  PinInput,
  Text,
} from '@hina-ui/react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { codeLength, emailIssues, signUpIssues, type AuthView, type SignUpForm } from '../auth'
import { useFormFeedback } from '../use-form-feedback'
import { useSignUp } from '../use-sign-up'
import { FailureCallout } from './failure-callout'

const blank: SignUpForm = { name: '', email: '', code: '', password: '', adult: false }

export function SignUpFormView({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const t = useTranslations('auth.sign-up')
  const locale = useLocale()
  const [values, setValues] = useState<SignUpForm>(blank)
  const signUp = useSignUp(locale)
  const { form, explain, message } = useFormFeedback(signUp.failure ?? signUp.codeFailure)

  const sendCode = () => {
    const issues = explain(emailIssues(values))
    if (Object.keys(issues).length > 0) {
      form.current?.setErrors(issues)
      return
    }
    void signUp.requestCode(values.email)
  }

  const submit = async () => {
    if (signUp.sentTo === undefined) {
      form.current?.setErrors({ code: t('codeFirst') })
      return
    }
    await signUp.submit(values)
  }

  const codeHint = signUp.sentTo === undefined ? undefined : t('codeSent', { email: signUp.sentTo })

  return (
    <Form ref={form} values={values} rules={() => explain(signUpIssues(values))} onSubmit={submit}>
      {({ submitting }) => (
        <>
          <FormField name="name" label={t('name')} description={t('nameHint')} required>
            <Input
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              autoComplete="username"
              autoFocus
            />
          </FormField>
          <FormField name="email" label={t('email')} description={codeHint} required>
            <Inline gap="sm" wrap={false}>
              <Input
                value={values.email}
                onValueChange={email => setValues({ ...values, email })}
                type="email"
                autoComplete="email"
                className="min-w-0 flex-1"
              />
              <Button
                variant="soft"
                loading={signUp.requesting}
                disabled={signUp.cooldown > 0}
                onClick={sendCode}
                className="shrink-0"
              >
                {signUp.cooldown > 0 ? t('resendIn', { seconds: signUp.cooldown }) : t('sendCode')}
              </Button>
            </Inline>
          </FormField>
          <FormField name="code" label={t('code')} required>
            <PinInput
              value={values.code}
              onValueChange={code => setValues({ ...values, code })}
              length={codeLength}
              type="number"
              otp
            />
          </FormField>
          <FormField name="password" label={t('password')} description={t('passwordHint')} required>
            <PasswordInput
              value={values.password}
              onValueChange={password => setValues({ ...values, password })}
              autoComplete="new-password"
            />
          </FormField>
          <FormField name="adult">
            <Checkbox
              checked={values.adult}
              onCheckedChange={adult => setValues({ ...values, adult: adult === true })}
            >
              {t('adult')}
            </Checkbox>
          </FormField>
          <FailureCallout message={message} />
          <Button type="submit" loading={submitting} block>
            {t('submit')}
          </Button>
          <Inline gap="xs" justify="center" align="center">
            <Text size="sm" tone="muted">
              {t('hasAccount')}
            </Text>
            <Button variant="link" size="sm" onClick={() => onSwitch('sign-in')}>
              {t('toSignIn')}
            </Button>
          </Inline>
        </>
      )}
    </Form>
  )
}
