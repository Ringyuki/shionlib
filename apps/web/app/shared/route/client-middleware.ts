import {
  isRouteErrorResponse,
  type DataStrategyResult,
  type MiddlewareFunction,
} from 'react-router'
import { refusalOf, type Refused } from './refusal'
import { unwrapped } from './refusal.schema'
import { noteStaleReload, shownFor } from './shown-data'

const resourceRoutes = 'routes/resources.'

export function unanswered(thrown: unknown): boolean {
  const error = unwrapped(thrown)
  return !(error instanceof Response) && !(isRouteErrorResponse(error) && error.status < 500)
}

export const answerEveryRequest: MiddlewareFunction<Record<string, DataStrategyResult>> = async (
  { request },
  next,
) => {
  const results = await next()
  if (request.signal.aborted) {
    return results
  }
  const asked = new URL(request.url)
  const reads = request.method === 'GET'
  let stale: Refused | undefined
  let failed = false
  const answered = Object.entries(results).map(([id, result]): [string, DataStrategyResult] => {
    if (result.type !== 'error' || !unanswered(result.result)) {
      return [id, result]
    }
    console.error(result.result)
    const refusal = refusalOf(result.result)
    if (!reads || id.startsWith(resourceRoutes)) {
      return [id, { type: 'data', result: refusal }]
    }
    const kept = shownFor(id, asked)
    if (kept === undefined) {
      failed = true
      return [id, result]
    }
    stale = refusal
    return [id, { type: 'data', result: kept.data }]
  })
  if (stale !== undefined && !failed) {
    noteStaleReload(stale)
  }
  return Object.fromEntries(answered)
}
