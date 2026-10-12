import { Form, Stack, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { waiting, type Opened } from '../admin-check'
import { caseReviewForm, type CaseReviewValues } from '../admin-check.schema'
import { useCaseReview } from '../use-case-review'
import { CaseFacts } from './case-facts'
import { CaseFields } from './case-fields'
import { CaseOutcome } from './case-outcome'

type CasePaneProps = {
  opened: Opened | undefined
  onClose: () => void
}

const blank: CaseReviewValues = { decision: null, note: '', notify: true }

export function CasePane({ opened, onClose }: CasePaneProps) {
  const t = useTranslations('adminCheck')
  const issue = useTranslations('adminCheck.issue')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = opened !== undefined
  const shown = useLast(opened)
  const [reviewing] = useOpenState(open, () => opened !== undefined && waiting(opened.detail))
  const [values, setValues] = useOpenState(open, () => blank)
  const review = useCaseReview()
  const form = useFormErrors(review.failure)
  return (
    <ReviewPane
      heading={reviewing ? t('pane.title') : t('pane.viewTitle')}
      note={shown === undefined ? undefined : t('pane.number', { id: shown.detail.id })}
      open={open}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <CaseFacts opened={shown} />
            {reviewing ? (
              <PaneSection label={t('pane.review')}>
                <Form
                  ref={form}
                  values={values}
                  rules={caseReviewForm(kit, issue)}
                  onSubmit={async () => {
                    if (values.decision === null) {
                      return
                    }
                    const { decision } = values
                    const outcome = await review.run({ ...values, decision, id: shown.detail.id })
                    if (outcome.ok) {
                      onClose()
                      toast.success(t('reviewed', { decision }))
                    }
                  }}
                >
                  <CaseFields policy={shown.policy} values={values} onValuesChange={setValues} />
                </Form>
              </PaneSection>
            ) : (
              <CaseOutcome detail={shown.detail} />
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
