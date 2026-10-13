import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { routeCommand, type RouteChange } from './admin-ai-route.schema'
import type { aiRouteAction } from './admin-ai-route.server'

export function useRouteChange() {
  const command = useCommand(useFetcher<typeof aiRouteAction>(), href('/resources/admin/ai/routes'))
  return {
    ...command,
    submitted: parseOptional(routeCommand, command.payload),
    run: (change: RouteChange) => command.run(change),
    confirm: (change: RouteChange) => command.confirm(change),
  }
}
