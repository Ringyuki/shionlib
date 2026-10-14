import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { QuickReview } from './admin-check.schema'
import type { quickReviewAction } from './admin-check.server'

export function useQuickReview() {
  const command = useCommand(
    useFetcher<typeof quickReviewAction>(),
    href('/resources/admin/checks/quick-review'),
  )
  return { ...command, confirm: (review: QuickReview) => command.confirm(review) }
}
