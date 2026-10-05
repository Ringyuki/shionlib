import { href } from 'react-router'
import type { ResourceReport } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useReportResource(onDone: () => void) {
  return useResourceCommand<ResourceReport>(href('/resources/resource/report'), {
    onDone,
    revalidate: false,
  })
}
