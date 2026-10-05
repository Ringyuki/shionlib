import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  languageOptions,
  leastLanguages,
  leastPlatforms,
  needsSimulator,
  platformOptions,
  reportReasons,
  simulatorOptions,
  type Resource,
} from './resource'

export type ResourceIssue = 'platforms' | 'languages' | 'simulator'

export type ResourceIssueMessage = (issue: ResourceIssue) => string

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const platforms = v.array(v.picklist(platformOptions))

const languages = v.array(v.picklist(languageOptions))

const simulator = v.union([v.picklist(simulatorOptions), v.literal('')])

export const reportCommand = v.object({
  resourceId: id,
  reason: v.picklist(reportReasons),
  detail: v.string(),
})

export type ResourceReport = v.InferOutput<typeof reportCommand>

export const editCommand = v.object({
  resourceId: id,
  platform: platforms,
  language: languages,
  simulator,
  note: v.string(),
})

export type ResourceEdit = v.InferOutput<typeof editCommand>

export const deleteCommand = v.object({ resourceId: id })

export type ResourceDeletion = v.InferOutput<typeof deleteCommand>

export function reportForm(kit: FormKit) {
  return v.object({
    reason: v.picklist(reportReasons),
    detail: kit.text('CreateReportInputBody', 'detail'),
  })
}

export type ReportValues = v.InferInput<ReturnType<typeof reportForm>>

export function editForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.pipe(
    v.object({
      platform: v.pipe(platforms, v.minLength(leastPlatforms, issue('platforms'))),
      language: v.pipe(languages, v.minLength(leastLanguages, issue('languages'))),
      simulator,
      note: kit.text('EditDownloadSourceBodyInput', 'note'),
    }),
    v.forward(
      v.partialCheck(
        [['platform'], ['simulator']],
        input => !needsSimulator(input.platform) || input.simulator !== '',
        issue('simulator'),
      ),
      ['simulator'],
    ),
  )
}

export type EditValues = v.InferInput<ReturnType<typeof editForm>>

export function editValuesFrom(resource: Resource): EditValues {
  const platform = resource.platform ?? []
  const language = resource.language ?? []
  return {
    platform: platformOptions.filter(option => platform.includes(option)),
    language: languageOptions.filter(option => language.includes(option)),
    simulator: simulatorOptions.find(option => option === resource.simulator) ?? '',
    note: resource.note ?? '',
  }
}

const fileQuery = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

export function fileParam(raw: string | null): number | undefined {
  const parsed = v.safeParse(fileQuery, raw)
  return parsed.success ? parsed.output : undefined
}
