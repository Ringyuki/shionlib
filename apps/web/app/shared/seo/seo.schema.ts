import * as v from 'valibot'

const siteData = v.object({
  publicConfig: v.object({ siteUrl: v.string(), ogImageUrl: v.string() }),
})

export type Site = v.InferOutput<typeof siteData>['publicConfig']

export function siteFrom(loaderData: unknown): Site | undefined {
  const parsed = v.safeParse(siteData, loaderData)
  return parsed.success ? parsed.output.publicConfig : undefined
}
