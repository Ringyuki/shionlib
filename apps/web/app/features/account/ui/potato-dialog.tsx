import { Dialog, Form, FormField, Input, PasswordInput, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { potatoBindingForm, type PotatoBindingValues } from '../account.schema'
import { usePotatoBinding } from '../use-connections'

const blank: PotatoBindingValues = { name: '', password: '' }

type PotatoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PotatoDialog({ open, onOpenChange }: PotatoDialogProps) {
  const t = useTranslations('account.potato')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const binding = usePotatoBinding()
  const form = useFormErrors(binding.failure)
  return (
    <Dialog
      title={t('bindTitle')}
      description={t('bindDescription')}
      open={open}
      onOpenChange={onOpenChange}
      locked={binding.pending}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={potatoBindingForm(kit)}
          onSubmit={async () => {
            const outcome = await binding.run(values)
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('bound'))
            }
          }}
        >
          <FormField name="name" label={t('name')} required>
            <Input
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              autoComplete="off"
              autoFocus
            />
          </FormField>
          <FormField name="password" label={t('password')} description={t('passwordHint')} required>
            <PasswordInput
              value={values.password}
              onValueChange={password => setValues({ ...values, password })}
              autoComplete="off"
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={binding.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={binding.pending} onClick={() => void form.current?.submit()}>
            {t('bind')}
          </Button>
        </>
      )}
    />
  )
}
