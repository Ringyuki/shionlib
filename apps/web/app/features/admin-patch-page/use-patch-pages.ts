import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { Assignment, Lookup } from './admin-patch-page.schema'
import type {
  patchPageLookupAction,
  patchPagesAction,
  patchPagesLoader,
} from './admin-patch-page.server'

export function usePatchPages() {
  const fetched = useLazyLoad(useFetcher<typeof patchPagesLoader>())
  return {
    ...fetched,
    load: (id: number) => fetched.load(`${href('/resources/admin/patch-pages')}?id=${id}`),
  }
}

export function useAssignPatchPages() {
  const command = useCommand(
    useFetcher<typeof patchPagesAction>(),
    href('/resources/admin/patch-pages'),
    { revalidate: false },
  )
  return { ...command, run: (assignment: Assignment) => command.run(assignment) }
}

export function usePatchPageLookup() {
  const command = useCommand(
    useFetcher<typeof patchPageLookupAction>(),
    href('/resources/admin/patch-pages/lookup'),
    { revalidate: false },
  )
  return { ...command, run: (lookup: Lookup) => command.run(lookup) }
}
