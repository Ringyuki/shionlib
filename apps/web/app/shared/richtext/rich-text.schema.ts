import * as v from 'valibot'
import { constraints } from '~/shared/api/generated/constraints'
import type { RichDocument, RichMark, RichNode } from './rich-text'

const node = constraints.RichTextNode

const mark = constraints.RichTextMark

const richMark: v.GenericSchema<RichMark> = v.strictObject({
  type: v.picklist(mark.type.enum),
  attrs: v.exactOptional(v.strictObject({ href: v.exactOptional(v.string()) })),
})

const richNode: v.GenericSchema<RichNode> = v.strictObject({
  type: v.picklist(node.type.enum),
  content: v.exactOptional(v.array(v.lazy(() => richNode))),
  marks: v.exactOptional(v.array(richMark)),
  text: v.exactOptional(v.string()),
})

export const richDocument: v.GenericSchema<RichDocument> = v.strictObject({
  type: v.literal('doc'),
  content: v.array(richNode),
})

const linkProtocols: readonly string[] = ['http:', 'https:', 'mailto:']

const written = v.pipe(v.string(), v.trim(), v.minLength(1))

const address = v.pipe(
  v.string(),
  v.url(),
  v.transform(value => new URL(value)),
  v.check(url => linkProtocols.includes(url.protocol)),
  v.transform(url => url.href),
  v.maxLength(mark.attrs.fields.href.maxLength),
)

const located = v.pipe(v.string(), v.url())

export function linkAddressFrom(raw: unknown): string | undefined {
  const text = v.safeParse(written, raw)
  if (!text.success) {
    return undefined
  }
  const candidate = v.is(located, text.output) ? text.output : `https://${text.output}`
  const parsed = v.safeParse(address, candidate)
  return parsed.success ? parsed.output : undefined
}

export function documentFrom(raw: unknown): RichDocument | undefined {
  const parsed = v.safeParse(richDocument, raw)
  return parsed.success ? parsed.output : undefined
}
