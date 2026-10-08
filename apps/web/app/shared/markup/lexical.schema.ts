import * as v from 'valibot'
import type { LexicalNode } from './lexical'

const node: v.GenericSchema<LexicalNode> = v.object({
  type: v.string(),
  text: v.nullish(v.string()),
  format: v.nullish(v.union([v.number(), v.string()])),
  url: v.nullish(v.string()),
  children: v.nullish(v.array(v.lazy(() => node))),
})

const document = v.object({ root: node })

export function lexicalRootFrom(value: unknown): LexicalNode | undefined {
  const parsed = v.safeParse(document, value)
  return parsed.success ? parsed.output.root : undefined
}
