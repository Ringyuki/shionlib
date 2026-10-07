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

export type ResourceIssue = 'platforms' | 'languages' | 'simulator' | 'files'

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

const platformField = (issue: ResourceIssueMessage) =>
  v.pipe(platforms, v.minLength(leastPlatforms, issue('platforms')))

const languageField = (issue: ResourceIssueMessage) =>
  v.pipe(languages, v.minLength(leastLanguages, issue('languages')))

const filesField = (issue: ResourceIssueMessage) =>
  v.pipe(v.array(v.instance(File)), v.minLength(1, issue('files')))

export function editForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.pipe(
    v.object({
      platform: platformField(issue),
      language: languageField(issue),
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

export function uploadForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.pipe(
    v.object({
      platform: platformField(issue),
      language: languageField(issue),
      simulator,
      note: kit.text('DownloadSourceBodyInput', 'note'),
      files: filesField(issue),
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

export type UploadValues = v.InferInput<ReturnType<typeof uploadForm>>

export function addFilesForm(issue: ResourceIssueMessage) {
  return v.object({ files: filesField(issue) })
}

export type AddFilesValues = v.InferInput<ReturnType<typeof addFilesForm>>

export function replaceForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.object({
    files: filesField(issue),
    reason: kit.text('DownloadReuploadInputBody', 'reason'),
  })
}

export type ReplaceValues = v.InferInput<ReturnType<typeof replaceForm>>

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

const idQuery = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

export function queryId(raw: string | null): number | undefined {
  const parsed = v.safeParse(idQuery, raw)
  return parsed.success ? parsed.output : undefined
}
