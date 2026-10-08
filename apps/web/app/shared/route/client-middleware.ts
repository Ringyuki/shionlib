import {
  isRouteErrorResponse,
  type DataStrategyResult,
  type MiddlewareFunction,
} from 'react-router'
import { unreachable } from './refusal'
import { noteStaleReload, shownFor } from './shown-data'

const resourceRoutes = 'routes/resources.'

export function unanswered(error: unknown): boolean {
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
  let stale = false
  const answered = Object.entries(results).map(([id, result]): [string, DataStrategyResult] => {
    if (result.type !== 'error' || !unanswered(result.result)) {
      return [id, result]
    }
    if (!reads || id.startsWith(resourceRoutes)) {
      return [id, { type: 'data', result: unreachable }]
    }
    const kept = shownFor(id, asked)
    if (kept === undefined) {
      return [id, result]
    }
    stale = true
    return [id, { type: 'data', result: kept.data }]
  })
  if (stale) {
    noteStaleReload()
  }
  return Object.fromEntries(answered)
}
