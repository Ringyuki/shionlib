import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { languageOptions } from './resource'
import { composeModes, composedTranslations, wizardSteps } from './resource-composition'
import { infoFields, infoRules } from './resource-info.schema'
import { filesField, id, languageField, type ResourceIssueMessage } from './resource.schema'

const placed = v.optional(v.string())

export const compositionCommand = v.variant('intent', [
  v.object({
    intent: v.literal('begin'),
    gameId: id,
    baseResourceId: id,
    replacing: v.optional(id),
  }),
  v.object({
    intent: v.literal('edit'),
    compositionId: id,
    language: v.array(v.picklist(languageOptions)),
    translation: v.union([v.picklist(composedTranslations), v.literal('')]),
    translators: v.array(v.string()),
    patchVersion: v.string(),
    releaseUrl: v.string(),
    keepPatch: v.boolean(),
    gameDir: placed,
    patchDir: placed,
  }),
  v.object({ intent: v.literal('start'), compositionId: id }),
  v.object({ intent: v.literal('retry'), compositionId: id }),
  v.object({ intent: v.literal('discard'), compositionId: id }),
  v.object({ intent: v.literal('detach'), compositionId: id, role: v.picklist(['patch', 'save']) }),
])

export type CompositionCommand = v.InferOutput<typeof compositionCommand>

export type CompositionEdit = Extract<CompositionCommand, { intent: 'edit' }>

export function detailsForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.pipe(
    v.object({
      language: languageField(issue),
      ...infoFields(field =>
        field === 'edition_name' ? v.string() : kit.text('EditCompositionInputBody', field),
      ),
    }),
    infoRules(issue, true),
  )
}

export function updatePatchForm(kit: FormKit, issue: ResourceIssueMessage) {
  return v.object({
    files: filesField(issue),
    patchVersion: kit.text('RebuildCompositionInputBody', 'patch_version'),
    note: kit.text('RebuildCompositionInputBody', 'note'),
  })
}

export type UpdatePatchValues = v.InferInput<ReturnType<typeof updatePatchForm>>

const idParam = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

export function composeQueryFrom(params: URLSearchParams) {
  const read = <T>(schema: v.GenericSchema<string, T>, key: string) => {
    const parsed = v.safeParse(schema, params.get(key))
    return parsed.success ? parsed.output : undefined
  }
  return {
    mode: read(v.picklist(composeModes), 'mode') ?? 'upload',
    compositionId: read(idParam, 'composition'),
    step: read(v.picklist(wizardSteps), 'step'),
  }
}
