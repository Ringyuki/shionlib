import * as v from 'valibot'
import { constraints } from '~/shared/api/generated/constraints'
import type { CellAlign, Picture, RichDocument, RichMark, RichNode } from './rich-text'

const node = constraints.RichTextNode

const mark = constraints.RichTextMark

const richMark: v.GenericSchema<RichMark> = v.strictObject({
  type: v.picklist(mark.type.enum),
  attrs: v.exactOptional(v.strictObject({ href: v.exactOptional(v.string()) })),
})

const attrs = node.attrs.fields

const nodeAttrs = v.strictObject({
  level: v.exactOptional(v.picklist(attrs.level.enum)),
  src: v.exactOptional(v.string()),
  alt: v.exactOptional(v.string()),
  caption: v.exactOptional(v.string()),
  width: v.exactOptional(v.number()),
  height: v.exactOptional(v.number()),
  colspan: v.exactOptional(v.number()),
  rowspan: v.exactOptional(v.number()),
  colwidth: v.exactOptional(v.nullable(v.array(v.number()))),
  width_percent: v.exactOptional(v.number()),
  align: v.exactOptional(v.nullable(v.picklist(attrs.align.enum))),
})

const richNode: v.GenericSchema<RichNode> = v.strictObject({
  type: v.picklist(node.type.enum),
  attrs: v.exactOptional(nodeAttrs),
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

const cellAlign = v.picklist(attrs.align.enum)

export function alignmentFrom(raw: unknown): CellAlign | null {
  const parsed = v.safeParse(cellAlign, raw)
  return parsed.success ? parsed.output : null
}

const storedPicture = v.pipe(
  v.object({
    src: v.string(),
    alt: v.fallback(v.string(), ''),
    caption: v.fallback(v.string(), ''),
    width: v.number(),
    height: v.number(),
    width_percent: v.fallback(v.number(), attrs.width_percent.maximum),
  }),
  v.transform(({ width_percent: widthPercent, ...rest }): Picture => ({ ...rest, widthPercent })),
)

const pictureText = v.pipe(v.string(), v.parseJson(), storedPicture)

export function pictureFrom(raw: unknown): Picture | undefined {
  const parsed = v.safeParse(storedPicture, raw)
  return parsed.success ? parsed.output : undefined
}

export function pictureAttrsFromText(raw: unknown): Record<string, unknown> | undefined {
  const parsed = v.safeParse(pictureText, raw)
  if (!parsed.success) {
    return undefined
  }
  const { widthPercent, ...rest } = parsed.output
  return { ...rest, width_percent: widthPercent }
}

export const pictureWidths = {
  least: attrs.width_percent.minimum,
  whole: attrs.width_percent.maximum,
}

export const captionLimits = { alt: attrs.alt.maxLength, caption: attrs.caption.maxLength }

export function documentFrom(raw: unknown): RichDocument | undefined {
  const parsed = v.safeParse(richDocument, raw)
  return parsed.success ? parsed.output : undefined
}
