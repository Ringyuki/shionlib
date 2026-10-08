import { Checkbox, Dialog, Form, FormField, Input, Textarea, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { listCreationForm, type ListCreationValues } from '../favorite.schema'
import { useCreateList } from '../use-create-list'

const blank: ListCreationValues = { name: '', description: '', isPrivate: false }

type NewListDialogProps = {
  gameId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewListDialog({ gameId, open, onOpenChange }: NewListDialogProps) {
  const t = useTranslations('favorite')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const creation = useCreateList()
  const form = useFormErrors(creation.failure)
  return (
    <Dialog
      title={t('newList')}
      description={t('newListDescription')}
      open={open}
      onOpenChange={onOpenChange}
      locked={creation.pending}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={listCreationForm(kit)}
          onSubmit={async () => {
            const outcome = await creation.run({ gameId, ...values })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('created', { name: outcome.result.name }))
            }
          }}
        >
          <FormField
            name="name"
            label={t('listName')}
            description={t('listNameHint', lengthOf('CreateFavoriteInputBody', 'name'))}
            required
          >
            <Input
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              placeholder={t('listNamePlaceholder')}
              autoFocus
            />
          </FormField>
          <FormField
            name="description"
            label={t('listDescription')}
            description={t(
              'listDescriptionHint',
              lengthOf('CreateFavoriteInputBody', 'description'),
            )}
          >
            <Textarea
              value={values.description}
              onValueChange={description => setValues({ ...values, description })}
              autosize={{ minRows: 2, maxRows: 6 }}
            />
          </FormField>
          <FormField name="isPrivate">
            <Checkbox
              checked={values.isPrivate}
              onCheckedChange={checked => setValues({ ...values, isPrivate: checked === true })}
              description={t('makePrivateHint')}
            >
              {t('makePrivate')}
            </Checkbox>
          </FormField>
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={creation.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={creation.pending} onClick={() => void form.current?.submit()}>
            {t('create')}
          </Button>
        </>
      )}
    />
  )
}
