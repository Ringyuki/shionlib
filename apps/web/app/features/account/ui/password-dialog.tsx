import { Dialog, Form, FormField, PasswordInput, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { passwordForm, type PasswordValues } from '../account.schema'
import { usePasswordChange } from '../use-password-change'

const blank: PasswordValues = { oldPassword: '', password: '', confirmation: '' }

type PasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PasswordDialog({ open, onOpenChange }: PasswordDialogProps) {
  const t = useTranslations('account.password')
  const issue = useTranslations('account.issue')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const change = usePasswordChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={passwordForm(kit, issue)}
          onSubmit={async () => {
            const outcome = await change.run({
              oldPassword: values.oldPassword,
              password: values.password,
            })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('changed'))
            }
          }}
        >
          <FormField name="oldPassword" label={t('old')} required>
            <PasswordInput
              value={values.oldPassword}
              onValueChange={oldPassword => setValues({ ...values, oldPassword })}
              autoComplete="current-password"
              autoFocus
            />
          </FormField>
          <FormField name="password" label={t('new')} required>
            <PasswordInput
              value={values.password}
              onValueChange={password => setValues({ ...values, password })}
              autoComplete="new-password"
            />
          </FormField>
          <FormField name="confirmation" label={t('confirmation')} required>
            <PasswordInput
              value={values.confirmation}
              onValueChange={confirmation => setValues({ ...values, confirmation })}
              autoComplete="new-password"
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
