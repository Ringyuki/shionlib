import { Form, FormField, Inline, Input } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { full, listed, maxPages, type Draft, type PatchPage } from '../admin-patch-page'
import { addressForm, type AddressValues } from '../admin-patch-page.schema'
import { usePatchPageLookup } from '../use-patch-pages'

type AddressFormProps = {
  draft: Draft
  onAdd: (page: PatchPage) => void
}

export function AddressForm({ draft, onAdd }: AddressFormProps) {
  const t = useTranslations('adminPatchPage')
  const issue = useTranslations('adminPatchPage.issue')
  const kit = useFormKit()
  const lookup = usePatchPageLookup()
  const form = useFormErrors(lookup.failure)
  const [values, setValues] = useState<AddressValues>({ address: '' })
  const address = lengthOf('AdminPatchPageLookupInputBody', 'address')
  return (
    <Form
      ref={form}
      values={values}
      rules={addressForm(kit)}
      onSubmit={async () => {
        if (full(draft)) {
          form.current?.setErrors({ address: issue('full', { max: maxPages }) })
          return
        }
        const outcome = await lookup.run({ address: values.address })
        if (!outcome.ok) {
          return
        }
        if (listed(draft, outcome.result.id)) {
          form.current?.setErrors({ address: issue('duplicate') })
          return
        }
        onAdd(outcome.result)
        setValues({ address: '' })
        form.current?.reset()
      }}
    >
      <FormField name="address" label={t('address')}>
        <Inline gap="sm" wrap={false}>
          <Input
            className="min-w-0 flex-1"
            value={values.address}
            placeholder={t('placeholder')}
            maxLength={address.max}
            onValueChange={next => setValues({ address: next })}
          />
          <Button type="submit" variant="outline" tone="neutral" loading={lookup.pending}>
            <Plus aria-hidden />
            {t('add')}
          </Button>
        </Inline>
      </FormField>
    </Form>
  )
}
