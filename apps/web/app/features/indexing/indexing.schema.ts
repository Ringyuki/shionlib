import * as v from 'valibot'

const askedFor = v.object({
  section: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  page: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1))),
})

export type SitemapAsked = { section: string; page: number }

export function sitemapRequestFrom(search: URLSearchParams): SitemapAsked | undefined {
  if (!search.has('section')) {
    return undefined
  }
  const parsed = v.safeParse(askedFor, Object.fromEntries(search))
  return parsed.success
    ? { section: parsed.output.section, page: parsed.output.page ?? 1 }
    : undefined
}
