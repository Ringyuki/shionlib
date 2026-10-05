import { Alert, Checkbox, Form, FormField, Inline, Input, toast } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { Button } from '~/shared/ui/button'
import { listCreationForm, type ListCreationValues } from '../favorite.schema'
import { useCreateList } from '../use-create-list'

const blank: ListCreationValues = { name: '', isPrivate: false }

export function NewListForm({ gameId }: { gameId: number }) {
  const t = useTranslations('favorite')
  const kit = useFormKit()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<ListCreationValues>(blank)
  const creation = useCreateList(name => {
    setEditing(false)
    setValues(blank)
    toast.success(t('created', { name }))
  })
  const { form, message } = useSubmissionFeedback(creation.failure)
  if (!editing) {
    return (
      <Button
        variant="link"
        tone="neutral"
        size="sm"
        icon={<Plus />}
        onClick={() => setEditing(true)}
        className="self-start"
      >
        {t('newList')}
      </Button>
    )
  }
  return (
    <Form
      ref={form}
      values={values}
      rules={listCreationForm(kit)}
      onSubmit={() => creation.submit({ gameId, ...values })}
    >
      {({ submitting }) => (
        <>
          <FormField name="name" label={t('listName')}>
            <Input
              size="sm"
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              placeholder={t('listNamePlaceholder')}
              autoFocus
            />
          </FormField>
          <Checkbox
            size="sm"
            checked={values.isPrivate}
            onCheckedChange={checked => setValues({ ...values, isPrivate: checked === true })}
          >
            {t('makePrivate')}
          </Checkbox>
          <Alert tone="danger" open={message !== undefined}>
            {message}
          </Alert>
          <Inline gap="sm" justify="end">
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              onClick={() => {
                setEditing(false)
                setValues(blank)
              }}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              {t('create')}
            </Button>
          </Inline>
        </>
      )}
    </Form>
  )
}
