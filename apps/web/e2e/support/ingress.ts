import { test as base } from '@playwright/test'

export type IngressOptions = { apiOrigin: string | undefined }

const apiPrefix = '/api'

export const test = base.extend<IngressOptions>({
  apiOrigin: [undefined, { option: true }],
  context: async ({ context, baseURL, apiOrigin }, provide) => {
    if (apiOrigin !== undefined && baseURL !== undefined) {
      const site = new URL(baseURL).origin
      await context.route(
        url => url.origin === site && url.pathname.startsWith(`${apiPrefix}/`),
        route => {
          const url = new URL(route.request().url())
          return route.continue({
            url: `${apiOrigin}${url.pathname.slice(apiPrefix.length)}${url.search}`,
          })
        },
      )
    }
    await provide(context)
  },
})
