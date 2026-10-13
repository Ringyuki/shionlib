import * as v from 'valibot'
import { constraints } from '~/shared/api/generated/constraints'
import { firstIssueMessage } from '~/shared/form/check'
import type { FormKit } from '~/shared/form/form-kit'
import { richDocument } from '~/shared/richtext/rich-text.schema'
import { stepFrom, stepsFrom } from './walkthrough-steps'

export type RouteIssue =
  | { kind: 'name' }
  | { kind: 'steps' }
  | { kind: 'line'; line: number; max: number }
  | { kind: 'remark'; line: number; max: number }
  | { kind: 'tooManySteps'; max: number }
  | { kind: 'tooManyCharacters'; max: number }

export type RouteIssueMessage = (issue: RouteIssue) => string

export const routeFields = ['characters', 'name', 'condition', 'steps', 'ending'] as const

export type RouteField = (typeof routeFields)[number]

export type RouteErrors = Partial<Record<RouteField, string>>

export type Refused = { part: 'note'; message: string } | { part: number; errors: RouteErrors }

export const routeLimits = {
  routes: constraints.WriteWalkthroughInputBody.routes.maxItems,
  characters: constraints.WalkthroughRouteInput.characters.maxItems,
  steps: constraints.WalkthroughRouteInput.steps.maxItems,
  text: constraints.WalkthroughStepInput.text.maxLength,
  remark: constraints.WalkthroughStepInput.remark.maxLength,
}

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const step = v.object({
  kind: v.picklist(constraints.WalkthroughStepInput.kind.enum),
  text: v.string(),
  remark: v.string(),
  slot: v.string(),
})

const route = v.object({
  key: v.string(),
  name: v.string(),
  characters: v.array(id),
  requires: v.array(v.string()),
  condition: v.string(),
  ending: v.string(),
  steps: v.array(step),
})

export const walkthroughSaveCommand = v.object({
  gameId: id,
  note: v.optional(richDocument),
  routes: v.array(route),
  publish: v.boolean(),
})

export type WalkthroughSave = v.InferOutput<typeof walkthroughSaveCommand>

export const walkthroughRemovalCommand = v.object({ walkthroughId: id })

export type WalkthroughRemoval = v.InferOutput<typeof walkthroughRemovalCommand>

function length(text: string): number {
  return [...text].length
}

function lineIssue(text: string): RouteIssue | undefined {
  for (const [index, line] of text.split('\n').entries()) {
    const read = stepFrom(line)
    if (length(read.text) > routeLimits.text) {
      return { kind: 'line', line: index + 1, max: routeLimits.text }
    }
    if (length(read.remark) > routeLimits.remark) {
      return { kind: 'remark', line: index + 1, max: routeLimits.remark }
    }
  }
  return undefined
}

function stepsIssue(text: string, publishing: boolean): RouteIssue | undefined {
  const steps = stepsFrom(text)
  if (steps.length > routeLimits.steps) {
    return { kind: 'tooManySteps', max: routeLimits.steps }
  }
  return publishing && steps.length === 0 ? { kind: 'steps' } : lineIssue(text)
}

export function routeForm(kit: FormKit, issue: RouteIssueMessage, publishing: boolean) {
  const named = kit.text('WalkthroughRouteInput', 'name')
  return v.object({
    characters: v.pipe(
      v.array(v.number()),
      v.maxLength(
        routeLimits.characters,
        issue({ kind: 'tooManyCharacters', max: routeLimits.characters }),
      ),
    ),
    name: v.pipe(
      v.string(),
      v.rawCheck(({ dataset, addIssue }) => {
        if (!dataset.typed) {
          return
        }
        const message =
          dataset.value.trim() === ''
            ? publishing
              ? issue({ kind: 'name' })
              : undefined
            : firstIssueMessage(named, dataset.value)
        if (message !== undefined) {
          addIssue({ message })
        }
      }),
    ),
    condition: kit.text('WalkthroughRouteInput', 'condition'),
    steps: v.pipe(
      v.string(),
      v.rawCheck(({ dataset, addIssue }) => {
        const found = dataset.typed ? stepsIssue(dataset.value, publishing) : undefined
        if (found !== undefined) {
          addIssue({ message: issue(found) })
        }
      }),
    ),
    ending: kit.text('WalkthroughRouteInput', 'ending'),
  })
}

export type RouteValues = v.InferInput<ReturnType<typeof routeForm>>

export function routeErrors(form: ReturnType<typeof routeForm>, values: RouteValues): RouteErrors {
  const parsed = v.safeParse(form, values)
  const nested = parsed.success ? {} : (v.flatten<typeof form>(parsed.issues).nested ?? {})
  const errors: RouteErrors = {}
  for (const field of routeFields) {
    const message = nested[field]?.[0]
    if (message !== undefined) {
      errors[field] = message
    }
  }
  return errors
}

const ordinal = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))),
  undefined,
)

export function ordinalFrom(raw: string | null): number | undefined {
  return v.parse(ordinal, raw ?? undefined)
}

const located = /^routes\[(\d+)\]\.([a-z]+)/u

const place = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(0))

const fieldName = v.picklist(routeFields)

export function refusedFrom(messages: Readonly<Record<string, string>>): Refused | undefined {
  for (const [field, message] of Object.entries(messages)) {
    if (field === 'note') {
      return { part: 'note', message }
    }
    const [, index, name] = located.exec(field) ?? []
    const at = v.safeParse(place, index)
    const named = v.safeParse(fieldName, name)
    if (at.success) {
      return { part: at.output, errors: { [named.success ? named.output : 'steps']: message } }
    }
  }
  return undefined
}
