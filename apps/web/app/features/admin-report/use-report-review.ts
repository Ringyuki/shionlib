import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { Review } from './admin-report.schema'
import type { reviewReportAction } from './admin-report.server'

export function useReportReview() {
  const command = useCommand(
    useFetcher<typeof reviewReportAction>(),
    href('/resources/admin/reports/review'),
  )
  return { ...command, run: (review: Review) => command.run(review) }
}
