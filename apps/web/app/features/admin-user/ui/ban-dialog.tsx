import {
  Checkbox,
  Dialog,
  Form,
  FormField,
  NumberInput,
  SegmentedControl,
  Textarea,
  toast,
} from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { banChoices, banLengths, custom, permanent, type UserDetail } from '../admin-user'
import { banForm, maxBanDays, type BanValues } from '../admin-user.schema'
import { useUserChange } from '../use-user-change'

type BanDialogProps = {
  detail: UserDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

const firstChoice = banLengths[1]

const blank: BanValues = {
  choice: String(firstChoice),
  days: firstChoice,
  reason: '',
  removeComments: false,
}

function daysOf(choice: string, typed: number | null): number | null {
  if (choice === permanent) {
    return null
  }
  return banLengths.find(length => String(length) === choice) ?? typed
}

export function BanDialog({ detail, open, onOpenChange }: BanDialogProps) {
  const t = useTranslations('adminUser.ban')
  const shared = useTranslations('admin')
  const issue = useTranslations('adminUser.issue')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const change = useUserChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title', { name: detail.name })}
      description={t('description')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={banForm(kit, issue)}
          onSubmit={async () => {
            const outcome = await change.run({
              action: 'ban',
              id: detail.id,
              days: daysOf(values.choice, values.days),
              reason: values.reason,
              removeComments: values.removeComments,
            })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('done', { name: detail.name }))
            }
          }}
        >
          <FormField name="choice" label={t('length')}>
            <SegmentedControl
              value={values.choice}
              options={banChoices.map(choice => ({
                value: String(choice),
                label:
                  choice === permanent || choice === custom
                    ? t(`lengths.${choice}`)
                    : t('days', { count: choice }),
              }))}
              onValueChange={choice =>
                setValues({
                  ...values,
                  choice: String(choice),
                  days:
                    daysOf(String(choice), values.days) ?? (choice === custom ? firstChoice : null),
                })
              }
            />
          </FormField>
          {values.choice === custom && (
            <FormField name="days" label={t('customDays')}>
              <NumberInput
                className="w-40"
                min={1}
                max={maxBanDays}
                value={values.days}
                onValueChange={days => setValues({ ...values, days: days ?? null })}
              />
            </FormField>
          )}
          <FormField
            name="reason"
            label={t('reason')}
            description={t('reasonHint', lengthOf('AdminUserBanInputBody', 'banned_reason'))}
            required
          >
            <Textarea
              value={values.reason}
              onValueChange={reason => setValues({ ...values, reason })}
              autosize={{ minRows: 2, maxRows: 5 }}
            />
          </FormField>
          <FormField name="removeComments">
            <Checkbox
              checked={values.removeComments}
              onCheckedChange={checked =>
                setValues({ ...values, removeComments: checked === true })
              }
            >
              {t('removeComments')}
            </Checkbox>
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
