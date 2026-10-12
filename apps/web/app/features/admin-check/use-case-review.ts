import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { CaseReview } from './admin-check.schema'
import type { reviewCaseAction } from './admin-check.server'

export function useCaseReview() {
  const command = useCommand(
    useFetcher<typeof reviewCaseAction>(),
    href('/resources/admin/checks/review'),
  )
  return {
    ...command,
    run: (review: CaseReview) => command.run(review),
    confirm: (review: CaseReview) => command.confirm(review),
  }
}
