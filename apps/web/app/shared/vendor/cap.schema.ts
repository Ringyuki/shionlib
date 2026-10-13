import * as v from 'valibot'

const problem = v.object({
  code: v.optional(v.string()),
  message: v.optional(v.string()),
})

export type CapProblem = { code: string; message: string }

export function capProblemFrom(value: unknown): CapProblem {
  const parsed = v.safeParse(problem, value)
  return {
    code: parsed.success ? (parsed.output.code ?? 'unknown') : 'unknown',
    message: parsed.success ? (parsed.output.message ?? '') : '',
  }
}
