import { Dialog, Form, Inline, Stack, Text, toast } from '@hina-ui/react'
import { Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { PaneSection } from '~/features/admin'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { changesOf, draftOf, routeName, unchanged, type Route } from '../admin-ai-route'
import { routeForm } from '../admin-ai-route.schema'
import { useRouteChange } from '../use-route-change'
import { useAdjustmentText } from './route-adjustments'
import { RouteFields } from './route-fields'

type RouteEditDialogProps = {
  route: Route | undefined
  protocols: readonly string[] | null | undefined
  onClose: () => void
}

export function RouteEditDialog({ route, protocols, onClose }: RouteEditDialogProps) {
  const t = useTranslations('adminAiRoute.edit')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = route !== undefined
  const shown = useLast(route)
  const [draft, setDraft] = useOpenState(open, () =>
    route === undefined ? undefined : draftOf(route),
  )
  const change = useRouteChange()
  const revert = useRouteChange()
  const adjustmentText = useAdjustmentText()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
      description={shown === undefined ? undefined : routeName(shown)}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      renderContent={() =>
        shown === undefined || draft === undefined ? null : (
          <Stack gap="lg">
            <Form
              ref={form}
              values={{ upstreamId: draft.upstreamId }}
              rules={routeForm(kit)}
              onSubmit={async () => {
                const changes = changesOf(shown, draft)
                if (!unchanged(changes)) {
                  const outcome = await change.run({ action: 'update', id: shown.id, changes })
                  if (!outcome.ok) {
                    return
                  }
                  toast.success(t('saved'))
                }
                onClose()
              }}
            >
              <RouteFields
                route={shown}
                draft={draft}
                protocols={protocols}
                onChange={changes => setDraft({ ...draft, ...changes })}
              />
            </Form>
            {(shown.adjustments ?? []).length > 0 && (
              <PaneSection label={t('adjustments')}>
                {(shown.adjustments ?? []).map(adjustment => (
                  <Inline
                    key={adjustment.id}
                    gap="sm"
                    align="center"
                    justify="between"
                    wrap={false}
                  >
                    <Text as="span" size="sm">
                      {adjustmentText(adjustment)}
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      tone="neutral"
                      icon={<Undo2 />}
                      loading={revert.pending && revert.submitted?.action === 'revert'}
                      onClick={async () => {
                        const outcome = await revert.run({
                          action: 'revert',
                          id: shown.id,
                          adjustmentId: adjustment.id,
                        })
                        if (outcome.ok) {
                          onClose()
                          toast.success(t('reverted'))
                        }
                      }}
                    >
                      {t('revert')}
                    </Button>
                  </Inline>
                ))}
              </PaneSection>
            )}
          </Stack>
        )
      }
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
