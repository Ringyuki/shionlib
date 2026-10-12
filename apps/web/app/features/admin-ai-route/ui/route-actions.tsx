import { Inline, toast } from '@hina-ui/react'
import { Pencil, Play, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { errorKindOf, useAiFormat } from '~/features/admin-ai'
import { IconButton } from '~/shared/ui/button'
import { routeName, type Route } from '../admin-ai-route'
import { useRouteChange } from '../use-route-change'

type RouteActionsProps = {
  route: Route
  editable: boolean
  onEdit: (route: Route) => void
  onRemove: (route: Route) => void
}

export function RouteActions({ route, editable, onEdit, onRemove }: RouteActionsProps) {
  const t = useTranslations('adminAiRoute')
  const kinds = useTranslations('adminAi.errorKind')
  const format = useAiFormat()
  const change = useRouteChange()
  const check = async () => {
    const outcome = await change.run({ action: 'check', id: route.id })
    if (!outcome.ok || outcome.result === null) {
      return
    }
    const { ok, error, route: checked } = outcome.result
    if (ok || error === null) {
      toast.success(t('check.ok', { route: routeName(route) }), {
        description:
          checked.last?.first_token_ms == null
            ? undefined
            : t('check.firstToken', { time: format.latency(checked.last.first_token_ms) }),
      })
      return
    }
    toast.danger(
      t('check.failed', { route: routeName(route), kind: kinds(errorKindOf(error.kind)) }),
      { description: error.message },
    )
  }
  const tools = { variant: 'ghost', tone: 'neutral', size: 'sm', disabled: !editable } as const
  return (
    <Inline gap="none" align="center" justify="end" wrap={false}>
      <IconButton {...tools} label={t('action.check')} loading={change.pending} onClick={check}>
        <Play />
      </IconButton>
      <IconButton {...tools} label={t('action.edit')} onClick={() => onEdit(route)}>
        <Pencil />
      </IconButton>
      <IconButton {...tools} label={t('action.remove')} onClick={() => onRemove(route)}>
        <Trash2 />
      </IconButton>
    </Inline>
  )
}
