import { Dialog, Form, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { FavoriteList } from '../favorite'
import { listForm, type ListValues } from '../favorite.schema'
import { useListEdit } from '../use-list-edit'
import { ListFields } from './list-fields'

type EditListDialogProps = {
  list: FavoriteList
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditListDialog({ list, open, onOpenChange }: EditListDialogProps) {
  const t = useTranslations('favorite')
  const kit = useFormKit()
  const [values, setValues] = useOpenState<ListValues>(open, () => ({
    name: list.name,
    description: list.description ?? '',
    isPrivate: list.is_private,
  }))
  const edit = useListEdit()
  const form = useFormErrors(edit.failure)
  return (
    <Dialog
      title={t('editList')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={listForm(kit)}
          onSubmit={async () => {
            const outcome = await edit.run({ listId: list.id, ...values })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('listSaved'))
            }
          }}
        >
          <ListFields values={values} onValuesChange={setValues} named={!list.default} />
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
