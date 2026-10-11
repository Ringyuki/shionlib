import { Dialog, Form, FormField, Textarea, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { FavoriteItem } from '../favorite'
import { noteForm, type NoteValues } from '../favorite.schema'
import { useNoteChange } from '../use-note-change'

type NoteDialogProps = {
  item: FavoriteItem | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NoteDialog({ item, open, onOpenChange }: NoteDialogProps) {
  const t = useTranslations('favorite')
  const kit = useFormKit()
  const [values, setValues] = useOpenState<NoteValues>(open, () => ({ note: item?.note ?? '' }))
  const change = useNoteChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('editNote')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={noteForm(kit)}
          onSubmit={async () => {
            if (item === undefined) {
              return
            }
            const outcome = await change.run({ itemId: item.id, note: values.note })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('noteSaved'))
            }
          }}
        >
          <FormField
            name="note"
            label={t('note')}
            description={t('noteHint', lengthOf('UpdateFavoriteItemInputBody', 'note'))}
          >
            <Textarea
              value={values.note}
              onValueChange={note => setValues({ note })}
              autosize={{ minRows: 3, maxRows: 10 }}
              autoFocus
            />
          </FormField>
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
