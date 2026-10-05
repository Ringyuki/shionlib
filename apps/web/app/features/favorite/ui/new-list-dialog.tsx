import {
  Alert,
  Checkbox,
  Dialog,
  Form,
  FormField,
  Inline,
  Input,
  Textarea,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
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
  const [values, setValues] = useState<ListCreationValues>(blank)
  const creation = useCreateList(name => {
    onOpenChange(false)
    setValues(blank)
    toast.success(t('created', { name }))
  })
  const { form, message } = useSubmissionFeedback(creation.failure)
  return (
    <Dialog
      title={t('newList')}
      description={t('newListDescription')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={listCreationForm(kit)}
          onSubmit={() => creation.submit({ gameId, ...values })}
        >
          {({ submitting }) => (
            <>
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
              <Alert tone="danger" open={message !== undefined}>
                {message}
              </Alert>
              <Inline gap="sm" justify="end">
                <Button variant="ghost" tone="neutral" onClick={close}>
                  {t('cancel')}
                </Button>
                <Button type="submit" loading={submitting}>
                  {t('create')}
                </Button>
              </Inline>
            </>
          )}
        </Form>
      )}
    />
  )
}
