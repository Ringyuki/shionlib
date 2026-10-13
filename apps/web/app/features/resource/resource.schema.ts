import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { infoValuesFrom } from './resource-info'
import { infoCommand, infoFields, infoRules, type InfoIssue } from './resource-info.schema'
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

export type ResourceIssue = 'platforms' | 'languages' | 'simulator' | 'files' | InfoIssue

export type ResourceIssueMessage = (issue: ResourceIssue) => string

export const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

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
  ...infoCommand,
})

export type ResourceEdit = v.InferOutput<typeof editCommand>

const nameQuery = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    gameId: id,
    resourceId: v.optional(id),
    fileName: v.string(),
    language: languages,
    ...infoCommand,
  }),
)

export function nameQueryFrom(raw: string | null) {
  const parsed = v.safeParse(nameQuery, raw)
  return parsed.success ? parsed.output : undefined
}

export const deleteCommand = v.object({ resourceId: id })

export type ResourceDeletion = v.InferOutput<typeof deleteCommand>

export const renameFileCommand = v.object({ fileId: id, name: v.string() })

export type FileRename = v.InferOutput<typeof renameFileCommand>

export const removeFileCommand = v.object({ fileId: id })

export type FileRemoval = v.InferOutput<typeof removeFileCommand>

export function renameFileForm(kit: FormKit) {
  return v.object({ name: kit.text('RenameDownloadFileInputBody', 'file_name') })
}

export type RenameFileValues = v.InferInput<ReturnType<typeof renameFileForm>>

export function reportForm(kit: FormKit) {
  return v.object({
    reason: v.picklist(reportReasons),
    detail: kit.text('CreateReportInputBody', 'detail'),
  })
}

export type ReportValues = v.InferInput<ReturnType<typeof reportForm>>

const platformField = (issue: ResourceIssueMessage) =>
  v.pipe(platforms, v.minLength(leastPlatforms, issue('platforms')))

export const languageField = (issue: ResourceIssueMessage) =>
  v.pipe(languages, v.minLength(leastLanguages, issue('languages')))

export const filesField = (issue: ResourceIssueMessage) =>
  v.pipe(v.array(v.instance(File)), v.minLength(1, issue('files')))

export function editForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.pipe(
    v.object({
      platform: platformField(issue),
      language: languageField(issue),
      simulator,
      note: kit.text('EditDownloadSourceBodyInput', 'note'),
      ...infoFields(field => kit.text('EditDownloadSourceBodyInput', field)),
    }),
    infoRules(issue, false),
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
      ...infoFields(field => kit.text('DownloadSourceBodyInput', field)),
      files: filesField(issue),
    }),
    infoRules(issue, true),
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

type Editable = Pick<Resource, 'platform' | 'language' | 'simulator' | 'note'> &
  Parameters<typeof infoValuesFrom>[0]

export function editValuesFrom(resource: Editable): EditValues {
  const platform = resource.platform ?? []
  const language = resource.language ?? []
  return {
    platform: platformOptions.filter(option => platform.includes(option)),
    language: languageOptions.filter(option => language.includes(option)),
    simulator: simulatorOptions.find(option => option === resource.simulator) ?? '',
    note: resource.note ?? '',
    ...infoValuesFrom(resource),
  }
}

const idQuery = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

export function queryId(raw: string | null): number | undefined {
  const parsed = v.safeParse(idQuery, raw)
  return parsed.success ? parsed.output : undefined
}
