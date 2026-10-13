import * as v from 'valibot'
import {
  credited,
  editionOptions,
  extraOptions,
  formOptions,
  mostTranslators,
  patched,
  translated,
  translationOptions,
  type InfoValues,
} from './resource-info'

export type InfoIssue = 'translation' | 'translators' | 'tooManyTranslators' | 'releaseUrl' | 'form'

export type InfoIssueMessage = (issue: InfoIssue) => string

type InfoText = (field: 'patch_version' | 'release_url' | 'edition_name') => v.GenericSchema<string>

type Described = InfoValues & { language: readonly string[] }

const webAddress = v.pipe(v.string(), v.regex(/^https?:\/\/\S+$/u))

export const infoCommand = {
  translation: v.union([v.picklist(translationOptions), v.literal('')]),
  translators: v.array(v.string()),
  patchVersion: v.string(),
  releaseUrl: v.string(),
  edition: v.union([v.picklist(editionOptions), v.literal('')]),
  editionName: v.string(),
  form: v.union([v.picklist(formOptions), v.literal('')]),
  extras: v.array(v.picklist(extraOptions)),
}

export function infoFields(text: InfoText) {
  return {
    ...infoCommand,
    patchVersion: text('patch_version'),
    releaseUrl: text('release_url'),
    editionName: text('edition_name'),
  }
}

export function infoIssues(values: Described, complete: boolean): [keyof InfoValues, InfoIssue][] {
  const found: [keyof InfoValues, InfoIssue][] = []
  const foreign = translated(values.language)
  const translation = foreign ? values.translation : ''
  const release = values.releaseUrl.trim()
  if (complete && foreign && translation === '') {
    found.push(['translation', 'translation'])
  }
  if (credited(translation) && values.translators.length === 0) {
    found.push(['translators', 'translators'])
  }
  if (credited(translation) && values.translators.length > mostTranslators) {
    found.push(['translators', 'tooManyTranslators'])
  }
  if (patched(translation) && release !== '' && !v.is(webAddress, release)) {
    found.push(['releaseUrl', 'releaseUrl'])
  }
  if (complete && values.form === '') {
    found.push(['form', 'form'])
  }
  return found
}

export function infoRules<Input extends Described>(issue: InfoIssueMessage, complete: boolean) {
  return v.rawCheck<Input>(({ dataset, addIssue }) => {
    if (!dataset.typed) {
      return
    }
    const values = dataset.value
    for (const [key, found] of infoIssues(values, complete)) {
      addIssue({
        message: issue(found),
        path: [{ type: 'object', origin: 'value', input: values, key, value: values[key] }],
      })
    }
  })
}
