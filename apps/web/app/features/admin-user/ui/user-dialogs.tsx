import { DatePicker, Dialog, Form, FormField, PasswordInput, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { siteDay } from '~/shared/i18n/site-time'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { UserDetail } from '../admin-user'
import { passwordForm } from '../admin-user.schema'
import { useUserChange } from '../use-user-change'

type UserDialogProps = {
  detail: UserDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PasswordDialog({ detail, open, onOpenChange }: UserDialogProps) {
  const t = useTranslations('adminUser.password')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const [password, setPassword] = useOpenState(open, () => '')
  const change = useUserChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={{ password }}
          rules={passwordForm(kit)}
          onSubmit={async () => {
            const outcome = await change.run({ action: 'password', id: detail.id, password })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('done'))
            }
          }}
        >
          <FormField
            name="password"
            label={t('label')}
            description={t('hint', lengthOf('AdminUserPasswordInputBody', 'password'))}
            required
          >
            <PasswordInput
              value={password}
              onValueChange={setPassword}
              autoComplete="new-password"
            />
          </FormField>
          <Text as="span" size="sm" tone="muted">
            {t('consequence')}
          </Text>
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

const endOfDay = 'T23:59:59+08:00'

export function BadgeDialog({ detail, open, onOpenChange }: UserDialogProps) {
  const t = useTranslations('adminUser.badge')
  const shared = useTranslations('admin')
  const [day, setDay] = useOpenState<string | null>(open, () =>
    detail.sponsor_expires_at === null ? null : siteDay(new Date(detail.sponsor_expires_at)),
  )
  const change = useUserChange()
  return (
    <Dialog
      title={t('dialog')}
      description={t('description')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <FormField label={t('until')} description={t('untilHint')}>
          <DatePicker value={day} onValueChange={setDay} clearable />
        </FormField>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={change.pending} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            loading={change.pending}
            onClick={async () => {
              const outcome = await change.run({
                action: 'badge',
                id: detail.id,
                until: day === null ? null : `${day}${endOfDay}`,
              })
              if (outcome.ok) {
                onOpenChange(false)
                toast.success(t('saved', { cleared: String(day === null) }))
              }
            }}
          >
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
