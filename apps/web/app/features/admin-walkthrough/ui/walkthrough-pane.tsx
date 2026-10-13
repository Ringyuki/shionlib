import { Form, FormField, Inline, RadioGroup, Stack, toast } from '@hina-ui/react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { outcomes, type WalkthroughDetail } from '../admin-walkthrough'
import { outcomeForm, type OutcomeValues } from '../admin-walkthrough.schema'
import { useWalkthroughChange } from '../use-walkthrough-change'
import { WalkthroughFacts } from './walkthrough-facts'

type WalkthroughPaneProps = {
  opened: WalkthroughDetail | undefined
  onClose: () => void
}

const blank: OutcomeValues = { status: null }

export function WalkthroughPane({ opened, onClose }: WalkthroughPaneProps) {
  const t = useTranslations('adminWalkthrough')
  const shared = useTranslations('admin')
  const issue = useTranslations('adminWalkthrough.issue')
  const open = opened !== undefined
  const shown = useLast(opened)
  const [values, setValues] = useOpenState(open, () => blank)
  const change = useWalkthroughChange()
  const rescan = useWalkthroughChange()
  const form = useFormErrors(change.failure)
  return (
    <ReviewPane
      heading={t('pane.title')}
      note={shown === undefined ? undefined : t('pane.number', { id: shown.id })}
      open={open}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <WalkthroughFacts detail={shown} />
            <PaneSection label={t('pane.decision')}>
              <Form
                ref={form}
                values={values}
                rules={outcomeForm(issue)}
                onSubmit={async () => {
                  if (values.status === null) {
                    return
                  }
                  const { status } = values
                  const outcome = await change.run({ action: 'status', id: shown.id, status })
                  if (outcome.ok) {
                    onClose()
                    toast.success(t('changed', { status }))
                  }
                }}
              >
                <FormField name="status">
                  <RadioGroup
                    aria-label={t('pane.decision')}
                    block
                    value={values.status}
                    options={outcomes.map(outcome => ({
                      value: outcome,
                      label: t(`outcome.${outcome}`),
                      description: t(`outcomeHint.${outcome}`),
                    }))}
                    onValueChange={value =>
                      setValues({ status: outcomes.find(outcome => outcome === value) ?? null })
                    }
                  />
                </FormField>
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
                const outcome = await rescan.run({ action: 'rescan', id: shown.id })
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
