import * as v from 'valibot'
import type { Schema } from '~/shared/api/types'
import { kinds, type Change, type Setting, type Value } from './admin-setting'

const scalar = v.union([v.number(), v.boolean(), v.string()])

const bound = v.fallback(v.optional(v.number()), undefined)

const editor = v.fallback(v.optional(v.object({ name: v.string() })), undefined)

function valueFrom(raw: unknown): Value | undefined {
  const parsed = v.safeParse(scalar, raw)
  return parsed.success ? parsed.output : undefined
}

function fits(kind: Setting['kind'], value: Value): boolean {
  if (kind === 'flag') {
    return typeof value === 'boolean'
  }
  return kind === 'text' ? typeof value === 'string' : typeof value === 'number'
}

export function settingFrom(raw: Schema<'SettingDTO'>): Setting | undefined {
  const kind = kinds.find(known => known === raw.kind)
  const value = valueFrom(raw.value)
  const fallback = valueFrom(raw.default)
  if (kind === undefined || value === undefined || fallback === undefined) {
    return undefined
  }
  if (!fits(kind, value) || !fits(kind, fallback)) {
    return undefined
  }
  const last = raw.last_change
  return {
    name: raw.name,
    group: raw.group,
    label: raw.label,
    description: raw.description,
    kind,
    value,
    fallback,
    min: v.parse(bound, raw.min ?? undefined),
    max: v.parse(bound, raw.max ?? undefined),
    maxLength: raw.max_length ?? undefined,
    overridden: raw.overridden,
    lastChange:
      last === null
        ? undefined
        : { editor: v.parse(editor, last.editor ?? undefined)?.name, at: last.created },
  }
}

export function changeFrom(raw: Schema<'SettingChangeDTO'>): Change {
  return {
    id: raw.id,
    editor: v.parse(editor, raw.editor ?? undefined)?.name,
    at: raw.created,
    previous: valueFrom(raw.previous),
    value: valueFrom(raw.value),
  }
}

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(100))

export const settingCommand = v.object({
  changes: v.pipe(
    v.array(v.object({ name, value: scalar, restore: v.boolean() })),
    v.minLength(1),
    v.maxLength(100),
  ),
})

export type SettingSave = v.InferOutput<typeof settingCommand>

export function settingNameFrom(raw: string | null): string | undefined {
  const parsed = v.safeParse(name, raw)
  return parsed.success ? parsed.output : undefined
}
