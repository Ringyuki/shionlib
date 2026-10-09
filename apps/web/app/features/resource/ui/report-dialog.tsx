import { Dialog, Form, FormField, RadioGroup, Textarea, toast } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { commonReportReason, reportReasons } from '../resource'
import { reportForm, type ReportValues } from '../resource.schema'
import { useReportResource } from '../use-report-resource'

const blank: ReportValues = { reason: commonReportReason, detail: '' }

type ReportDialogProps = {
  resourceId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportDialog({ resourceId, open, onOpenChange }: ReportDialogProps) {
  const t = useTranslations('resource')
  const reasons = useMessages().resource.reason
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const report = useReportResource()
  const form = useFormErrors(report.failure)
  return (
    <Dialog
      title={t('reportTitle')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={reportForm(kit)}
          onSubmit={async () => {
            const outcome = await report.run({ resourceId, ...values })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('reported'))
            }
          }}
        >
          <FormField name="reason" label={t('reportReason')} required>
            <RadioGroup
              value={values.reason}
              onValueChange={reason => {
                const chosen = reportReasons.find(entry => entry === reason)
                if (chosen !== undefined) {
                  setValues({ ...values, reason: chosen })
                }
              }}
              options={reportReasons.map(reason => ({
                value: reason,
                label: labelOf(reasons, reason),
              }))}
            />
          </FormField>
          <FormField
            name="detail"
            label={t('reportDetail')}
            description={t('optionalHint', lengthOf('CreateReportInputBody', 'detail'))}
          >
            <Textarea
              value={values.detail}
              onValueChange={detail => setValues({ ...values, detail })}
              autosize={{ minRows: 3, maxRows: 8 }}
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button tone="danger" loading={submitting} onClick={() => void form.current?.submit()}>
            {t('reportSubmit')}
          </Button>
        </>
      )}
    />
  )
}
