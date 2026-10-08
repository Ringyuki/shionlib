import { Form, FormField, Inline, Panel, Textarea, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { bioForm, type BioValues } from '../settings.schema'
import { useBio } from '../use-bio'

export function BioPanel({ current }: { current: string }) {
  const t = useTranslations('settings.personal')
  const kit = useFormKit()
  const [values, setValues] = useState<BioValues>({ bio: current })
  const bio = useBio()
  const form = useFormErrors(bio.failure)
  return (
    <Panel title={t('bio')} description={t('bioHint')}>
      <Form
        ref={form}
        values={values}
        rules={bioForm(kit)}
        onSubmit={async () => {
          const outcome = await bio.run(values)
          if (outcome.ok) {
            toast.success(t('bioSaved'))
          }
        }}
      >
        <FormField name="bio" description={t('bioLimit', lengthOf('UpdateBioInputBody', 'bio'))}>
          <Textarea
            aria-label={t('bio')}
            value={values.bio}
            onValueChange={next => setValues({ bio: next })}
            autosize={{ minRows: 3, maxRows: 10 }}
          />
        </FormField>
        <Inline justify="end">
          <Button type="submit" loading={bio.pending} disabled={values.bio.trim() === current}>
            {t('save')}
          </Button>
        </Inline>
      </Form>
    </Panel>
  )
}
