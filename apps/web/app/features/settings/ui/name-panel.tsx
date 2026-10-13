import { Form, FormField, Inline, Input, Panel, toast } from '@hina-ui/react'
import { useEffect } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { nameForm } from '../settings.schema'
import { useRename } from '../use-rename'

export function NamePanel({ current }: { current: string }) {
  const t = useTranslations('settings.personal')
  const kit = useFormKit()
  const rename = useRename(current)
  const form = useFormErrors(rename.failure)
  const { taken } = rename
  useEffect(() => {
    if (taken) {
      form.current?.setErrors({ name: t('nameTaken') })
    }
  }, [form, taken, t])
  return (
    <Panel title={t('name')} description={t('nameHint')}>
      <Form
        ref={form}
        values={{ name: rename.name }}
        rules={nameForm(kit)}
        onSubmit={async () => {
          const outcome = await rename.save()
          if (outcome.ok) {
            toast.success(t('nameSaved'))
          }
        }}
      >
        <FormField
          name="name"
          description={
            rename.available
              ? t('nameAvailable')
              : t('nameLimit', lengthOf('UpdateNameInputBody', 'name'))
          }
          required
        >
          <Input
            aria-label={t('name')}
            value={rename.name}
            onValueChange={rename.setName}
            autoComplete="username"
          />
        </FormField>
        <Inline justify="end">
          <Button type="submit" loading={rename.pending} disabled={!rename.changed || taken}>
            {t('save')}
          </Button>
        </Inline>
      </Form>
    </Panel>
  )
}
