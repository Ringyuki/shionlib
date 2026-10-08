import { Dialog, Form, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { firstIssueMessage } from '~/shared/form/check'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { SentCodes } from '../account'
import { emailForm, newEmailForm, type EmailValues } from '../account.schema'
import { useEmailChange } from '../use-email-change'
import { EmailFields } from './email-fields'

const blank: EmailValues = { email: '', currentCode: '', newCode: '' }

type EmailDialogProps = {
  current: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailDialog({ current, open, onOpenChange }: EmailDialogProps) {
  const t = useTranslations('account.email')
  const issue = useTranslations('account.issue')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const [codes, setCodes] = useOpenState<SentCodes>(open, () => ({}))
  const change = useEmailChange()
  const form = useFormErrors(change.failure ?? change.fresh.failure)
  const sendCurrent = async () => {
    const outcome = await change.current.request()
    if (outcome.ok) {
      setCodes(sent => ({ ...sent, currentId: outcome.result.codeId }))
    }
  }
  const sendNew = async () => {
    const problem = firstIssueMessage(newEmailForm(kit), { email: values.email })
    if (problem !== undefined) {
      form.current?.setErrors({ email: problem })
      return
    }
    const email = values.email.trim()
    const outcome = await change.fresh.request(email)
    if (outcome.ok) {
      setCodes(sent => ({ ...sent, newId: outcome.result.codeId, sentTo: email }))
    }
  }
  const submit = async () => {
    const { currentId, newId } = codes
    if (currentId === undefined) {
      form.current?.setErrors({ currentCode: issue('currentCodeFirst') })
      return
    }
    if (newId === undefined) {
      form.current?.setErrors({ newCode: issue('newCodeFirst') })
      return
    }
    const outcome = await change.run({ ...values, currentId, newId })
    if (outcome.ok) {
      onOpenChange(false)
      toast.success(t('changed'))
    }
  }
  return (
    <Dialog
      title={t('title')}
      description={t('description')}
      open={open}
      onOpenChange={onOpenChange}
      locked={change.pending}
      renderContent={() => (
        <Form ref={form} values={values} rules={emailForm(kit)} onSubmit={submit}>
          <EmailFields
            current={current}
            values={values}
            onValuesChange={setValues}
            codes={codes}
            currentSender={change.current}
            newSender={change.fresh}
            onSendCurrent={() => void sendCurrent()}
            onSendNew={() => void sendNew()}
          />
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={change.pending} onClick={close}>
            {t('cancel')}
          </Button>
          <Button loading={change.pending} onClick={() => void form.current?.submit()}>
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
