import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

type Stored = Schema<'DownloadResourceDTO'>

type EditFields = Schema<'EditDownloadSourceBodyInput'>

export type Translation = NonNullable<EditFields['translation']>

export type Edition = NonNullable<EditFields['edition']>

export type PackageForm = NonNullable<EditFields['form']>

export type Extra = NonNullable<EditFields['extras']>[number]

export type ResourceInfo = Pick<
  EditFields,
  'translation' | 'patch_version' | 'release_url' | 'edition' | 'edition_name' | 'form'
> & {
  translators?: string[]
  extras: Extra[]
}

export type InfoValues = {
  translation: Translation | ''
  translators: string[]
  patchVersion: string
  releaseUrl: string
  edition: Edition | ''
  editionName: string
  form: PackageForm | ''
  extras: Extra[]
}

const editBody = constraints.EditDownloadSourceBodyInput

export const translationOptions: readonly Translation[] = editBody.translation.enum

export const editionOptions: readonly Edition[] = editBody.edition.enum

export const formOptions: readonly PackageForm[] = editBody.form.enum

export const extraOptions: readonly Extra[] = editBody.extras.itemEnum

export const mostTranslators = editBody.translators.maxItems

export const originalLanguage = 'jp'

export const blankInfo: InfoValues = {
  translation: '',
  translators: [],
  patchVersion: '',
  releaseUrl: '',
  edition: '',
  editionName: '',
  form: '',
  extras: [],
}

export function translated(languages: readonly string[]): boolean {
  return languages.some(language => language !== originalLanguage)
}

export function credited(translation: InfoValues['translation']): boolean {
  return translation === 'group'
}

export function patched(translation: InfoValues['translation']): boolean {
  return translation === 'group' || translation === 'machine'
}

export function resourceInfo(values: InfoValues, languages: readonly string[]): ResourceInfo {
  const translation = translated(languages) && values.translation !== '' ? values.translation : ''
  const version = patched(translation) ? values.patchVersion.trim() : ''
  const release = patched(translation) ? values.releaseUrl.trim() : ''
  const editionName = values.editionName.trim()
  return {
    ...(translation === '' ? {} : { translation }),
    ...(credited(translation) ? { translators: values.translators } : {}),
    ...(version === '' ? {} : { patch_version: version }),
    ...(release === '' ? {} : { release_url: release }),
    ...(values.edition === '' ? {} : { edition: values.edition }),
    ...(editionName === '' ? {} : { edition_name: editionName }),
    ...(values.form === '' ? {} : { form: values.form }),
    extras: extraOptions.filter(extra => values.extras.includes(extra)),
  }
}

type Described = Pick<
  Stored,
  | 'translation'
  | 'translators'
  | 'patch_version'
  | 'release_url'
  | 'edition'
  | 'edition_name'
  | 'form'
  | 'extras'
>

export function infoValuesFrom(resource: Described): InfoValues {
  const extras = resource.extras ?? []
  return {
    translation: resource.translation ?? '',
    translators: (resource.translators ?? []).map(translator => translator.name),
    patchVersion: resource.patch_version ?? '',
    releaseUrl: resource.release_url ?? '',
    edition: resource.edition ?? '',
    editionName: resource.edition_name ?? '',
    form: resource.form ?? '',
    extras: extraOptions.filter(extra => extras.includes(extra)),
  }
}

export type MissingInfo = 'translation' | 'form'

export function missingInfo(
  resource: Pick<Stored, 'language' | 'translation' | 'form'>,
): MissingInfo[] {
  const missing: MissingInfo[] = []
  if (translated(resource.language ?? []) && resource.translation === null) {
    missing.push('translation')
  }
  if (resource.form === null) {
    missing.push('form')
  }
  return missing
}

export function creditsOf(resource: Pick<Stored, 'translation' | 'translators'>) {
  return resource.translation === 'group' ? (resource.translators ?? []) : []
}

export function editionText(
  resource: Pick<Stored, 'edition' | 'edition_name'>,
  labelOf: (edition: Edition) => string,
): string {
  const parts = [
    resource.edition === null ? '' : labelOf(resource.edition),
    (resource.edition_name ?? '').trim(),
  ]
  return parts.filter(part => part !== '').join(' ')
}
