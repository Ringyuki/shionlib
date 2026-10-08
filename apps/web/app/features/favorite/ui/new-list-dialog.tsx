import { Dialog, Form, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { listForm, type ListValues } from '../favorite.schema'
import { useCreateList } from '../use-create-list'
import { ListFields } from './list-fields'

const blank: ListValues = { name: '', description: '', isPrivate: false }

type NewListDialogProps = {
  gameId?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (listId: number) => void
}

export function NewListDialog({ gameId, open, onOpenChange, onCreated }: NewListDialogProps) {
  const t = useTranslations('favorite')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const creation = useCreateList()
  const form = useFormErrors(creation.failure)
  const collecting = gameId !== undefined
  return (
    <Dialog
      title={t('newList')}
      description={collecting ? t('newListDescription') : undefined}
      open={open}
      onOpenChange={onOpenChange}
      locked={creation.pending}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={listForm(kit)}
          onSubmit={async () => {
            const outcome = await creation.run({ gameId, ...values })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(
                t(collecting ? 'created' : 'createdEmpty', { name: outcome.result.name }),
              )
              onCreated?.(outcome.result.id)
            }
          }}
        >
          <ListFields values={values} onValuesChange={setValues} named />
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={creation.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={creation.pending} onClick={() => void form.current?.submit()}>
            {t(collecting ? 'create' : 'createEmpty')}
          </Button>
        </>
      )}
    />
  )
}
