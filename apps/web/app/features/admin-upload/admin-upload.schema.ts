import * as v from 'valibot'
import {
  attemptKey,
  everyStage,
  maxQueryLength,
  sessionKey,
  stageFilters,
  type Filter,
  type Opened,
} from './admin-upload'

const idText = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const optionalId = v.fallback(v.optional(idText), undefined)

const stage = v.fallback(v.picklist(stageFilters), everyStage)

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

function openedFrom(search: URLSearchParams): Opened | undefined {
  const session = v.parse(optionalId, search.get(sessionKey) ?? undefined)
  if (session !== undefined) {
    return { kind: 'session', id: session }
  }
  const attempt = v.parse(optionalId, search.get(attemptKey) ?? undefined)
  return attempt === undefined ? undefined : { kind: 'attempt', id: attempt }
}

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    stage: v.parse(stage, search.get('stage') ?? everyStage),
    query: v.parse(query, search.get('q') ?? ''),
    user: v.parse(optionalId, search.get('user') ?? undefined),
    failed: search.get('failed') === '1',
    page,
    opened: openedFrom(search),
  }
}

export const uploadTerminationCommand = v.object({
  id: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
})

export type UploadTermination = v.InferOutput<typeof uploadTerminationCommand>
