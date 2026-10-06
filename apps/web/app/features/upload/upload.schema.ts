import * as v from 'valibot'
import { constraints } from '~/shared/api/generated/constraints'

const createBody = constraints.DownloadSourceBodyInput

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const size = v.pipe(v.number(), v.safeInteger(), v.minValue(0))

const resourceDraft = v.object({
  platform: v.array(v.picklist(createBody.platform.itemEnum)),
  language: v.array(v.picklist(createBody.language.itemEnum)),
  simulator: v.optional(v.picklist(createBody.simulator.enum)),
  note: v.optional(v.string()),
})

const target = v.variant('kind', [
  v.object({ kind: v.literal('create'), gameId: id, resource: resourceDraft }),
  v.object({ kind: v.literal('append'), resourceId: id }),
  v.object({ kind: v.literal('replace'), fileId: id, reason: v.optional(v.string()) }),
  v.object({ kind: v.literal('orphan') }),
])

const savedUpload = v.object({
  id: v.string(),
  submission: v.string(),
  file: v.object({ name: v.string(), size, lastModified: size }),
  name: v.optional(v.string()),
  session: v.optional(v.object({ id, chunkSize: id, totalChunks: id })),
  done: v.boolean(),
})

const savedSubmission = v.object({ id: v.string(), target, submitting: v.boolean() })

const savedState = v.object({
  submissions: v.array(savedSubmission),
  uploads: v.array(savedUpload),
})

export type SavedState = v.InferOutput<typeof savedState>

const storedState = v.fallback(v.pipe(v.string(), v.parseJson(), savedState), {
  submissions: [],
  uploads: [],
})

export function savedStateFrom(stored: string | null): SavedState {
  return v.parse(storedState, stored)
}

const hashJob = v.object({ file: v.instance(Blob), chunkSize: id })

export type HashJob = v.InferOutput<typeof hashJob>

export function hashJobFrom(data: unknown): HashJob {
  return v.parse(hashJob, data)
}

const hashReport = v.variant('kind', [
  v.object({ kind: v.literal('chunk'), index: size, sha256: v.string() }),
  v.object({ kind: v.literal('file'), blake3: v.string() }),
  v.object({ kind: v.literal('error'), message: v.string() }),
])

export type HashReport = v.InferOutput<typeof hashReport>

export function hashReportFrom(data: unknown): HashReport {
  const parsed = v.safeParse(hashReport, data)
  return parsed.success ? parsed.output : { kind: 'error', message: 'Unreadable hash report' }
}
