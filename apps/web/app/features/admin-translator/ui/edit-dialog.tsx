import { Dialog, Form, FormField, Input, TagsInput, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { mostAliases, type Translator } from '../admin-translator'
import { editForm, editValuesFrom, type EditValues } from '../admin-translator.schema'
import { useTranslatorChange } from '../use-translator-change'

type EditDialogProps = {
  translator: Translator | undefined
  onClose: () => void
}

const blank: EditValues = { name: '', aliases: [], homepage: '' }

export function EditDialog({ translator, onClose }: EditDialogProps) {
  const t = useTranslations('adminTranslator.edit')
  const shared = useTranslations('admin')
  const issue = useTranslations('adminTranslator.issue')
  const kit = useFormKit()
  const open = translator !== undefined
  const shown = useLast(translator)
  const [values, setValues] = useOpenState(open, () =>
    translator === undefined ? blank : editValuesFrom(translator),
  )
  const edit = useTranslatorChange()
  const form = useFormErrors(edit.failure)
  const name = lengthOf('AdminTranslatorEditInputBody', 'name')
  return (
    <Dialog
      title={t('title')}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={editForm(kit, key => issue(key, { max: mostAliases }))}
          onSubmit={async () => {
            if (shown === undefined) {
              return
            }
            const outcome = await edit.run({ action: 'edit', id: shown.id, ...values })
            if (outcome.ok) {
              onClose()
              toast.success(t('saved'))
            }
          }}
        >
          <FormField name="name" label={t('name')} required>
            <Input
              value={values.name}
              onValueChange={value => setValues({ ...values, name: value })}
              maxLength={name.max}
            />
          </FormField>
          <FormField name="aliases" label={t('aliases')} description={t('aliasesHint')}>
            <TagsInput
              value={values.aliases}
              onValueChange={aliases => setValues({ ...values, aliases })}
              max={mostAliases}
            />
          </FormField>
          <FormField name="homepage" label={t('homepage')}>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.homepage}
              onValueChange={homepage => setValues({ ...values, homepage })}
              maxLength={lengthOf('AdminTranslatorEditInputBody', 'homepage').max}
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
