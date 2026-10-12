import { Form, Stack, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { defaultLevel, type Opened } from '../admin-report'
import { reviewForm, type ReviewValues } from '../admin-report.schema'
import { useReportReview } from '../use-report-review'
import { ReportFacts } from './report-facts'
import { ReportOutcome } from './report-outcome'
import { ReviewFields } from './review-fields'

type ReportPaneProps = {
  opened: Opened | undefined
  onClose: () => void
}

function blankReview(opened: Opened | undefined): ReviewValues {
  return {
    verdict: null,
    level: opened === undefined ? 'MEDIUM' : defaultLevel(opened.policy, opened.detail.reason),
    remove: false,
    note: '',
    notify: true,
  }
}

export function ReportPane({ opened, onClose }: ReportPaneProps) {
  const t = useTranslations('adminReport.review')
  const issue = useTranslations('adminReport.issue')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = opened !== undefined
  const shown = useLast(opened)
  const [reviewing] = useOpenState(open, () => opened?.detail.status === 'PENDING')
  const [values, setValues] = useOpenState(open, () => blankReview(opened))
  const review = useReportReview()
  const form = useFormErrors(review.failure)
  return (
    <ReviewPane
      heading={reviewing ? t('title') : t('viewTitle')}
      note={shown === undefined ? undefined : t('number', { id: shown.detail.id })}
      open={open}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <ReportFacts opened={shown} />
            {reviewing ? (
              <PaneSection label={t('decision')}>
                <Form
                  ref={form}
                  values={values}
                  rules={reviewForm(kit, issue)}
                  onSubmit={async () => {
                    if (values.verdict === null) {
                      return
                    }
                    const outcome = await review.run({
                      ...values,
                      id: shown.detail.id,
                      verdict: values.verdict,
                    })
                    if (outcome.ok) {
                      onClose()
                      toast.success(t('done'))
                    }
                  }}
                >
                  <ReviewFields opened={shown} values={values} onValuesChange={setValues} />
                </Form>
              </PaneSection>
            ) : (
              <ReportOutcome detail={shown.detail} />
            )}
          </Stack>
        )
      }
      renderFooter={
        reviewing
          ? ({ close, submitting }) => (
              <>
                <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
                  {shared('cancel')}
                </Button>
                <Button loading={submitting} onClick={() => void form.current?.submit()}>
                  {shared('submit')}
                </Button>
              </>
            )
          : undefined
      }
    />
  )
}
