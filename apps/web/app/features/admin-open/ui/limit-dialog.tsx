import { Dialog, Form, FormField, NumberInput, RadioGroup, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { rangeOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { limitForm, type LimitValues } from '../admin-open.schema'
import { useOpenChange } from '../use-open-change'

export type Limiting = { userId: number; owner: string; limit: number | null }

type LimitDialogProps = {
  limiting: Limiting | undefined
  onClose: () => void
}

const modes = ['default', 'own'] as const

export function LimitDialog({ limiting, onClose }: LimitDialogProps) {
  const t = useTranslations('adminOpen.limit')
  const shared = useTranslations('admin')
  const open = limiting !== undefined
  const shown = useLast(limiting)
  const [values, setValues] = useOpenState<LimitValues>(open, () => ({
    own: limiting?.limit != null,
    limit: limiting?.limit ?? null,
  }))
  const change = useOpenChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
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
          rules={limitForm(t('required'))}
          onSubmit={async () => {
            if (shown === undefined) {
              return
            }
            const outcome = await change.run({
              action: 'limit',
              userId: shown.userId,
              limit: values.own ? values.limit : null,
            })
            if (outcome.ok) {
              onClose()
              toast.success(t('done'))
            }
          }}
        >
          <RadioGroup
            aria-label={t('title')}
            value={values.own ? 'own' : 'default'}
            options={modes.map(mode => ({
              value: mode,
              label: t(mode),
              description: mode === 'default' ? t('defaultHint') : undefined,
            }))}
            onValueChange={value => setValues({ ...values, own: value === 'own' })}
          />
          <FormField name="limit" label={t('perWindow')}>
            <NumberInput
              {...rangeOf('AccountLimitInputBody', 'limit')}
              disabled={!values.own}
              value={values.limit}
              onValueChange={limit => setValues({ ...values, limit: limit ?? null })}
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
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
