import type { Schema } from '~/shared/api/types'
import type { Language } from './resource'
import { resourceInfo, type InfoValues } from './resource-info'

export type NamePreview = Schema<'FileNameDTO'>

export type NameReading = Schema<'FileNameReadingDTO'>

export type NameQuery = InfoValues & {
  gameId: number
  resourceId?: number
  fileName: string
  language: Language[]
}

export const previewDelay = 300

export function nameBody(query: NameQuery) {
  const { translation, translators, patch_version, edition, edition_name, form } = resourceInfo(
    query,
    query.language,
  )
  return {
    language: query.language,
    file_name: query.fileName,
    ...(query.resourceId === undefined ? {} : { resource_id: query.resourceId }),
    ...(translation === undefined ? {} : { translation }),
    ...(translators === undefined ? {} : { translators }),
    ...(patch_version === undefined ? {} : { patch_version }),
    ...(edition === undefined ? {} : { edition }),
    ...(edition_name === undefined ? {} : { edition_name }),
    ...(form === undefined ? {} : { form }),
  }
}

export function previewable(query: Pick<NameQuery, 'language'>): boolean {
  return query.language.length > 0
}

export function filledFrom(values: InfoValues, reading: NameReading): Partial<InfoValues> {
  const translators = reading.translators ?? []
  return {
    ...(values.translation === '' && reading.translation !== null
      ? { translation: reading.translation }
      : {}),
    ...(values.translators.length === 0 && translators.length > 0 ? { translators } : {}),
    ...(values.patchVersion === '' && reading.patch_version !== null
      ? { patchVersion: reading.patch_version }
      : {}),
    ...(values.edition === '' && reading.edition !== null ? { edition: reading.edition } : {}),
    ...(values.editionName === '' && reading.edition_name !== null
      ? { editionName: reading.edition_name }
      : {}),
    ...(values.form === '' && reading.form !== null ? { form: reading.form } : {}),
  }
}

export function uploadedName(
  file: Pick<Schema<'DownloadFileDTO'>, 'file_name' | 'original_name'>,
): string | undefined {
  return file.original_name === null || file.original_name === file.file_name
    ? undefined
    : file.original_name
}
