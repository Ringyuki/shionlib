import * as v from 'valibot'

const reply = v.union([
  v.object({ result: v.string() }),
  v.object({ error: v.object({ code: v.number(), message: v.string() }) }),
])

export type Aria2Reply = v.InferOutput<typeof reply>

export function aria2ReplyFrom(value: unknown): Aria2Reply | undefined {
  const parsed = v.safeParse(reply, value)
  return parsed.success ? parsed.output : undefined
}
