import { ValidationError } from 'class-validator'
import { FieldError } from '../../shared/interfaces/response/response.interface'

export const flattenValidationErrors = (
  errors: ValidationError[],
  options?: { delimiter?: '.' | 'bracket' },
): FieldError[] => {
  const delimiter = options?.delimiter ?? '.'
  const out: FieldError[] = []

  const join = (parent: string | undefined, key: string) => {
    if (!parent) return key
    if (delimiter === 'bracket' && /^\d+$/.test(key)) return `${parent}[${key}]`
    return `${parent}${delimiter === 'bracket' ? (/^\d+$/.test(key) ? '' : '.') : '.'}${key}`
  }

  const walk = (err: ValidationError, parent?: string) => {
    const path = join(parent, err.property)
    if (err.constraints && Object.keys(err.constraints).length) {
      const msgs = Array.from(new Set(Object.values(err.constraints ?? {}))).map(msg =>
        normalizeMsg(msg, path),
      )
      out.push({ field: path, messages: msgs as string[] })
    }
    if (err.children?.length) {
      for (const child of err.children) walk(child, path)
    }
  }

  for (const e of errors) walk(e)
  return out
}

/*
 * this function is used to normalize the message
 * like: "should not exist" -> "validation.common.PROPERTY_SHOULD_NOT_EXIST|{property}"
 */
const normalizeMsg = (msg: unknown, property: string) => {
  if (typeof msg !== 'string') return msg
  if (/should not exist/i.test(msg) || /forbidden property/i.test(msg)) {
    return `validation.common.PROPERTY_SHOULD_NOT_EXIST|${JSON.stringify({ property })}`
  }
  return msg
}
