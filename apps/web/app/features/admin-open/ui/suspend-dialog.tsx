import { Dialog, Form, FormField, Textarea, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { suspendForm, type SuspendValues } from '../admin-open.schema'
import { useOpenChange } from '../use-open-change'

export type Suspending = { id: number; name: string; owner: string }

type SuspendDialogProps = {
  suspending: Suspending | undefined
  onClose: () => void
}

export function SuspendDialog({ suspending, onClose }: SuspendDialogProps) {
  const t = useTranslations('adminOpen.suspend')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = suspending !== undefined
  const shown = useLast(suspending)
  const [values, setValues] = useOpenState<SuspendValues>(open, () => ({ reason: '' }))
  const change = useOpenChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title', { name: shown?.name ?? '' })}
      description={t('description', { owner: shown?.owner ?? '' })}
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
          rules={suspendForm(kit)}
          onSubmit={async () => {
            if (shown === undefined) {
              return
            }
            const outcome = await change.run({
              action: 'suspend',
              id: shown.id,
              reason: values.reason,
            })
            if (outcome.ok) {
              onClose()
              toast.success(t('done'))
            }
          }}
        >
          <FormField name="reason" label={t('reason')} description={t('reasonHint')} required>
            <Textarea
              rows={3}
              value={values.reason}
              onValueChange={reason => setValues({ reason })}
              maxLength={lengthOf('SuspendKeyInputBody', 'reason').max}
              autoFocus
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button tone="danger" loading={submitting} onClick={() => void form.current?.submit()}>
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
