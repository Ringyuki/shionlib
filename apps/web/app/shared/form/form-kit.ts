import * as v from 'valibot'
import { constraints } from '~/shared/api/generated/constraints'

type Bodies = typeof constraints

export type BodyName = keyof Bodies

export type FieldName<Body extends BodyName> = Extract<keyof Bodies[Body], string>

export type FieldConstraint = {
  readonly type: string
  readonly required: boolean
  readonly nullable: boolean
  readonly format?: string
  readonly minLength?: number
  readonly maxLength?: number
  readonly minimum?: number
  readonly maximum?: number
  readonly pattern?: string
  readonly enum?: readonly unknown[]
  readonly itemEnum?: readonly unknown[]
  readonly minItems?: number
  readonly maxItems?: number
}

export type FieldIssue =
  | { kind: 'required' }
  | { kind: 'minLength'; min: number }
  | { kind: 'maxLength'; max: number }
  | { kind: 'format'; format: string }
  | { kind: 'pattern' }
  | { kind: 'enum' }

export type FieldIssueMessage = (issue: FieldIssue) => string

export type FormKit = {
  text: <Body extends BodyName>(body: Body, field: FieldName<Body>) => v.GenericSchema<string>
}

const formats: Readonly<Record<string, v.GenericSchema<string>>> = {
  email: v.pipe(v.string(), v.email()),
  uuid: v.pipe(v.string(), v.uuid()),
  uri: v.pipe(v.string(), v.url()),
}

export function constraintOf<Body extends BodyName>(
  body: Body,
  field: FieldName<Body>,
): FieldConstraint {
  const fields: Readonly<Record<string, FieldConstraint>> = constraints[body]
  return fields[field] ?? { type: 'unknown', required: false, nullable: true }
}

export function lengthOf<Body extends BodyName>(
  body: Body,
  field: FieldName<Body>,
): { min: number; max: number } {
  const constraint = constraintOf(body, field)
  return { min: constraint.minLength ?? 0, max: constraint.maxLength ?? Number.POSITIVE_INFINITY }
}

export function textIssue(constraint: FieldConstraint, value: string): FieldIssue | undefined {
  if (value.trim() === '') {
    return constraint.required ? { kind: 'required' } : undefined
  }
  const length = [...value].length
  if (constraint.minLength !== undefined && length < constraint.minLength) {
    return { kind: 'minLength', min: constraint.minLength }
  }
  if (constraint.maxLength !== undefined && length > constraint.maxLength) {
    return { kind: 'maxLength', max: constraint.maxLength }
  }
  const format = constraint.format === undefined ? undefined : formats[constraint.format]
  if (constraint.format !== undefined && format !== undefined && !v.is(format, value.trim())) {
    return { kind: 'format', format: constraint.format }
  }
  if (constraint.pattern !== undefined && !new RegExp(constraint.pattern).test(value)) {
    return { kind: 'pattern' }
  }
  if (constraint.enum !== undefined && !constraint.enum.includes(value)) {
    return { kind: 'enum' }
  }
  return undefined
}

export function createFormKit(message: FieldIssueMessage): FormKit {
  return {
    text: (body, field) => {
      const constraint = constraintOf(body, field)
      return v.pipe(
        v.string(),
        v.rawCheck(({ dataset, addIssue }) => {
          const issue = dataset.typed ? textIssue(constraint, dataset.value) : undefined
          if (issue !== undefined) {
            addIssue({ message: message(issue) })
          }
        }),
      )
    },
  }
}
