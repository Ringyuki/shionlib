import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useLast } from '~/shared/ui/use-last'
import type { Route } from '../admin-ai-route'
import { useRouteChange } from '../use-route-change'
import { RouteEditDialog } from './route-edit-dialog'

export type RouteAsk = { kind: 'edit' | 'remove'; route: Route } | undefined

type RouteDialogsProps = {
  asked: RouteAsk
  protocolsOf: (route: Route) => readonly string[] | null | undefined
  onClose: () => void
}

export function RouteDialogs({ asked, protocolsOf, onClose }: RouteDialogsProps) {
  const t = useTranslations('adminAiRoute.remove')
  const shared = useTranslations('admin')
  const change = useRouteChange()
  const editing = asked?.kind === 'edit' ? asked.route : undefined
  const removing = asked?.kind === 'remove' ? asked.route : undefined
  const removed = useLast(removing)
  return (
    <>
      <RouteEditDialog
        route={editing}
        protocols={editing === undefined ? undefined : protocolsOf(editing)}
        onClose={onClose}
      />
      <AlertDialog
        tone="danger"
        title={t('title')}
        description={
          removed === undefined
            ? undefined
            : t('description', { model: removed.model.name, provider: removed.provider.name })
        }
        confirmText={t('confirm')}
        cancelText={shared('cancel')}
        open={removing !== undefined}
        onOpenChange={open => {
          if (!open) {
            onClose()
          }
        }}
        onConfirm={async () => {
          if (removing !== undefined) {
            await change.confirm({ action: 'remove', id: removing.id })
            toast.success(t('done'))
          }
        }}
      />
    </>
  )
}
