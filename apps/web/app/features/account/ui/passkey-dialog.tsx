import { Alert, Dialog, Form, FormField, Input, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { passkeyForm, type PasskeyValues } from '../account.schema'
import { usePasskeyRegistration } from '../use-passkeys'

type PasskeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PasskeyDialog({ open, onOpenChange }: PasskeyDialogProps) {
  const t = useTranslations('account.passkey')
  const kit = useFormKit()
  const [values, setValues] = useOpenState<PasskeyValues>(open, () => ({ name: '' }))
  const registration = usePasskeyRegistration()
  const form = useFormErrors(registration.failure)
  const problem = open ? registration.problem : undefined
  return (
    <Dialog
      title={t('add')}
      description={t('addDescription')}
      open={open}
      onOpenChange={next => {
        registration.forget()
        onOpenChange(next)
      }}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={passkeyForm(kit)}
          onSubmit={async () => {
            if (await registration.register(values.name)) {
              onOpenChange(false)
              toast.success(t('added'))
            }
          }}
        >
          <FormField
            name="name"
            label={t('name')}
            description={t('nameHint', lengthOf('PasskeyRegisterOptionsInputBody', 'name'))}
          >
            <Input
              value={values.name}
              onValueChange={name => setValues({ name })}
              placeholder={t('namePlaceholder')}
              autoFocus
            />
          </FormField>
          <Alert tone="danger" open={problem !== undefined}>
            {problem === undefined ? null : t(`problem.${problem}`)}
          </Alert>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('continue')}
          </Button>
        </>
      )}
    />
  )
}
