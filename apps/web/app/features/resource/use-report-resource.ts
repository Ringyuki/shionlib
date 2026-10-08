import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ResourceReport } from './resource.schema'
import type { reportResourceAction } from './resource.server'

export function useReportResource() {
  const command = useCommand(
    useFetcher<typeof reportResourceAction>(),
    href('/resources/resource/report'),
    {
      revalidate: false,
    },
  )
  return {
    ...command,
    run: (report: ResourceReport) => command.run(report),
    confirm: (report: ResourceReport) => command.confirm(report),
  }
}
