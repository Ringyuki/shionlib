import { Dialog, toast } from '@hina-ui/react'
import { useEffect, useEffectEvent } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { draftOf, type Draft, type Target } from '../admin-patch-page'
import { useAssignPatchPages, usePatchPages } from '../use-patch-pages'
import { PatchPagesBody } from './patch-pages-body'

type PatchPagesDialogProps = {
  target: Target | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PatchPagesDialog({ target, open, onOpenChange }: PatchPagesDialogProps) {
  const t = useTranslations('adminPatchPage')
  const shared = useTranslations('admin')
  const fetched = usePatchPages()
  const assign = useAssignPatchPages()
  const [edited, setEdited] = useOpenState<Draft | undefined>(open, () => undefined)
  const id = target?.id
  const load = useEffectEvent((wanted: number) => void fetched.load(wanted))
  useEffect(() => {
    if (open && id !== undefined) {
      load(id)
    }
  }, [open, id])
  const loaded = fetched.result?.id === id && !fetched.loading ? fetched.result?.pages : undefined
  const draft = edited ?? (loaded === undefined ? undefined : draftOf(loaded))
  return (
    <Dialog
      title={t('title')}
      description={target?.name}
      size="lg"
      open={open}
      locked={assign.pending}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <PatchPagesBody
          pages={loaded}
          draft={draft}
          failed={fetched.failed}
          retrying={fetched.loading}
          onRetry={() => id !== undefined && load(id)}
          onChange={setEdited}
        />
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={assign.pending} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            loading={assign.pending}
            disabled={target === undefined || draft === undefined}
            onClick={async () => {
              if (target === undefined || draft === undefined) {
                return
              }
              const outcome = await assign.run({
                id: target.id,
                manual: draft.manual,
                pages: draft.assigned.map(page => page.id),
              })
              if (outcome.ok) {
                toast.success(t('saved', { name: target.name }))
                onOpenChange(false)
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
