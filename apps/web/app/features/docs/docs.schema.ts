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

const head = v.object({
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string(), ''),
  banner: v.optional(v.string()),
  date: day,
  author_uid: v.optional(v.number()),
  author_name: v.optional(v.string()),
  author_avatar: v.optional(v.string()),
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
    author:
      output.author_name === undefined
        ? undefined
        : { id: output.author_uid, name: output.author_name, avatar: output.author_avatar },
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
