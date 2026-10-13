import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  defaultSort,
  defaultView,
  maxQueryLength,
  mostAliases,
  sorts,
  views,
  type Filter,
  type Translator,
} from './admin-translator'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const view = v.fallback(v.picklist(views), defaultView)

const sort = v.fallback(v.picklist(sorts), defaultSort)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    view: v.parse(view, search.get('view') ?? defaultView),
    query: v.parse(query, search.get('q') ?? ''),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    page,
  }
}

export const translatorCommand = v.variant('action', [
  v.object({
    action: v.literal('edit'),
    id,
    name: v.string(),
    aliases: v.array(v.string()),
    homepage: v.string(),
  }),
  v.object({ action: v.literal('merge'), id, mergedIds: v.array(id) }),
  v.object({ action: v.literal('dismiss'), ids: v.array(id) }),
])

export type TranslatorChange = v.InferOutput<typeof translatorCommand>

export type TranslatorIssue = 'name' | 'tooManyAliases' | 'keep'

export type TranslatorIssueMessage = (issue: TranslatorIssue) => string

export function editForm(kit: FormKit, issue: TranslatorIssueMessage) {
  return v.object({
    name: v.pipe(
      kit.text('AdminTranslatorEditInputBody', 'name'),
      v.check(name => name.trim() !== '', issue('name')),
    ),
    aliases: v.pipe(v.array(v.string()), v.maxLength(mostAliases, issue('tooManyAliases'))),
    homepage: kit.text('AdminTranslatorEditInputBody', 'homepage'),
  })
}

export type EditValues = v.InferInput<ReturnType<typeof editForm>>

export function editValuesFrom(
  translator: Pick<Translator, 'name' | 'aliases' | 'homepage'>,
): EditValues {
  return {
    name: translator.name,
    aliases: [...(translator.aliases ?? [])],
    homepage: translator.homepage ?? '',
  }
}

export function mergeForm(issue: TranslatorIssueMessage) {
  return v.object({ keep: v.nonNullable(v.nullable(id), issue('keep')) })
}
