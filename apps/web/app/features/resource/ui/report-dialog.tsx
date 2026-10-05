import { Alert, Dialog, Form, FormField, Inline, RadioGroup, Textarea, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useMessages, useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useSubmissionFeedback } from '~/shared/form/use-submission-feedback'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
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
  const [values, setValues] = useState<ReportValues>(blank)
  const report = useReportResource(() => {
    onOpenChange(false)
    setValues(blank)
    toast.success(t('reported'))
  })
  const { form, message } = useSubmissionFeedback(report.failure)
  return (
    <Dialog
      title={t('reportTitle')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={reportForm(kit)}
          onSubmit={() => report.submit({ resourceId, ...values })}
        >
          {({ submitting }) => (
            <>
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
                description={t('reportDetailHint', lengthOf('CreateReportInputBody', 'detail'))}
              >
                <Textarea
                  value={values.detail}
                  onValueChange={detail => setValues({ ...values, detail })}
                  autosize={{ minRows: 3, maxRows: 8 }}
                />
              </FormField>
              <Alert tone="danger" open={message !== undefined}>
                {message}
              </Alert>
              <Inline gap="sm" justify="end">
                <Button variant="ghost" tone="neutral" onClick={close}>
                  {t('cancel')}
                </Button>
                <Button type="submit" tone="danger" loading={submitting}>
                  {t('reportSubmit')}
                </Button>
              </Inline>
            </>
          )}
        </Form>
      )}
    />
  )
}
