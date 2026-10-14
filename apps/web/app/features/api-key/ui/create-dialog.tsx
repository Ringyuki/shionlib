import { Alert, CopyButton, Dialog, Form, FormField, Input, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { Issued } from '../api-key'
import { keyForm, type KeyValues } from '../api-key.schema'
import { useKeyChange } from '../use-key-change'

type CreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDialog({ open, onOpenChange }: CreateDialogProps) {
  const t = useTranslations('apiKey')
  const kit = useFormKit()
  const [values, setValues] = useOpenState<KeyValues>(open, () => ({ name: '' }))
  const [issued, setIssued] = useOpenState<Issued | undefined>(open, () => undefined)
  const creation = useKeyChange()
  const form = useFormErrors(creation.failure)
  const name = lengthOf('CreateKeyInputBody', 'name')
  return (
    <Dialog
      title={t(issued === undefined ? 'dialog.title' : 'dialog.createdTitle')}
      size="lg"
      open={open}
      locked={issued !== undefined}
      closable={issued === undefined}
      onOpenChange={onOpenChange}
      renderContent={() =>
        issued === undefined ? (
          <Form
            ref={form}
            values={values}
            rules={keyForm(kit)}
            onSubmit={async () => {
              const outcome = await creation.run({ action: 'create', name: values.name })
              if (outcome.ok && outcome.result !== null) {
                setIssued(outcome.result)
              }
            }}
          >
            <FormField
              name="name"
              label={t('dialog.name')}
              description={t('dialog.nameHint', { max: name.max ?? 0 })}
              required
            >
              <Input
                value={values.name}
                onValueChange={next => setValues({ name: next })}
                maxLength={name.max}
                autoFocus
              />
            </FormField>
          </Form>
        ) : (
          <Stack gap="md">
            <Alert tone="warning" open>
              {t('dialog.warning')}
            </Alert>
            <FormField name="secret" label={issued.key.name}>
              <Input
                readOnly
                value={issued.secret}
                className="font-mono"
                trailing={<CopyButton text={issued.secret} label={t('dialog.copy')} tooltip />}
              />
            </FormField>
          </Stack>
        )
      }
      renderFooter={({ close, submitting }) =>
        issued === undefined ? (
          <>
            <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
              {t('cancel')}
            </Button>
            <Button loading={submitting} onClick={() => void form.current?.submit()}>
              {t('dialog.submit')}
            </Button>
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)}>{t('dialog.done')}</Button>
        )
      }
    />
  )
}
