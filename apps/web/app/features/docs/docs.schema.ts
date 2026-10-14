import * as v from 'valibot'
import { categories, type Category, type Doc, type DocRef, type PictureSize } from './docs'

const category = v.picklist(categories)

export function categoryFrom(value: unknown): Category | undefined {
  const parsed = v.safeParse(category, value)
  return parsed.success ? parsed.output : undefined
}

const day = v.pipe(
  v.union([v.string(), v.date()]),
  v.transform(value => (value instanceof Date ? value.toISOString() : value).slice(0, 10)),
  v.isoDate(),
)

const head = v.strictObject({
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string(), ''),
  banner: v.optional(v.string()),
  date: day,
  order: v.optional(v.pipe(v.number(), v.finite())),
  authors: v.optional(
    v.pipe(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
      v.check(ids => new Set(ids).size === ids.length),
    ),
    [],
  ),
})

export function docFrom(ref: DocRef, value: unknown): Doc | undefined {
  const parsed = v.safeParse(head, value)
  if (!parsed.success) {
    return undefined
  }
  const { output } = parsed
  return {
    ...ref,
    title: output.title,
    description: output.description,
    banner: output.banner,
    date: output.date,
    order: output.order,
    authorIds: output.authors,
  }
}

const extent = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.digits(), v.toNumber())]),
  v.finite(),
  v.minValue(1),
)

const pictureSize = v.object({ width: extent, height: extent })

export function pictureSizeFrom(value: unknown): PictureSize | undefined {
  const parsed = v.safeParse(pictureSize, value)
  return parsed.success ? parsed.output : undefined
}
