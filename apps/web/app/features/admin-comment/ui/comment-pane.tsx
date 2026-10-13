import { Form, Inline, Stack, toast } from '@hina-ui/react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { categories, PaneSection, ReviewPane } from '~/features/admin'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { awaiting, fallbackCategory, type Opened } from '../admin-comment'
import { reviewForm, type ReviewValues } from '../admin-comment.schema'
import { useCommentChange } from '../use-comment-change'
import { CommentFacts } from './comment-facts'
import { CommentFields } from './comment-fields'

type CommentPaneProps = {
  opened: Opened | undefined
  onClose: () => void
}

function blankReview(opened: Opened | undefined): ReviewValues {
  const judged = opened?.detail.moderations?.[0]?.top_category
  return {
    status: null,
    category: categories.find(category => category === judged) ?? fallbackCategory,
    reason: '',
    notify: true,
  }
}

export function CommentPane({ opened, onClose }: CommentPaneProps) {
  const t = useTranslations('adminComment')
  const shared = useTranslations('admin')
  const issue = useTranslations('adminComment.issue')
  const kit = useFormKit()
  const open = opened !== undefined
  const shown = useLast(opened)
  const [reviewing] = useOpenState(open, () => opened !== undefined && awaiting(opened.detail))
  const [values, setValues] = useOpenState(open, () => blankReview(opened))
  const review = useCommentChange()
  const rescan = useCommentChange()
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
            <CommentFacts opened={shown} />
            <PaneSection label={t('pane.review')}>
              <Form
                ref={form}
                values={values}
                rules={reviewForm(kit, issue)}
                onSubmit={async () => {
                  if (values.status === null) {
                    return
                  }
                  const { status } = values
                  const outcome = await review.run({
                    ...values,
                    action: 'review',
                    ids: [shown.detail.id],
                    status,
                  })
                  if (outcome.ok) {
                    onClose()
                    toast.success(t('reviewed', { status: String(status) }))
                  }
                }}
              >
                <CommentFields values={values} onValuesChange={setValues} />
              </Form>
            </PaneSection>
          </Stack>
        )
      }
      renderFooter={({ close, submitting }) => (
        <>
          <Inline className="me-auto">
            <Button
              variant="ghost"
              tone="neutral"
              icon={<RefreshCw />}
              loading={rescan.pending}
              disabled={submitting || shown === undefined}
              onClick={async () => {
                if (shown === undefined) {
                  return
                }
                const outcome = await rescan.run({ action: 'rescan', id: shown.detail.id })
                if (outcome.ok) {
                  toast.success(t('rescanned'))
                }
              }}
            >
              {t('pane.rescan')}
            </Button>
          </Inline>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {shared('submit')}
          </Button>
        </>
      )}
    />
  )
}
